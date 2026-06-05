from pathlib import Path

from app.providers.base import GenOptions, TaskStatus
from app.providers.mock import MockProvider


def test_submit_returns_id_then_succeeds_immediately_when_no_delay():
    provider = MockProvider(placeholder_video_url="/static/placeholder.mp4", delay_seconds=0)
    task_id = provider.submit([Path("a.jpg")], "prompt", GenOptions())
    assert task_id.startswith("mock-")

    result = provider.poll(task_id)
    assert result.status == TaskStatus.SUCCEEDED
    assert result.video_url == "/static/placeholder.mp4"


def test_poll_unknown_task_fails():
    provider = MockProvider(delay_seconds=0)
    result = provider.poll("does-not-exist")
    assert result.status == TaskStatus.FAILED
    assert result.error


def test_poll_running_before_delay_elapses():
    provider = MockProvider(delay_seconds=999)
    task_id = provider.submit([], "p", GenOptions())
    result = provider.poll(task_id)
    assert result.status == TaskStatus.RUNNING