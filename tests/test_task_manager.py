from app.core.task_manager import TaskManager
from app.providers.base import TaskStatus


def test_create_returns_pending_task_with_id():
    tm = TaskManager()
    task = tm.create()
    assert task.id
    assert task.status == TaskStatus.PENDING


def test_get_returns_same_task():
    tm = TaskManager()
    task = tm.create()
    assert tm.get(task.id) is task


def test_get_missing_returns_none():
    tm = TaskManager()
    assert tm.get("nope") is None


def test_update_mutates_fields():
    tm = TaskManager()
    task = tm.create()
    tm.update(task.id, status=TaskStatus.SUCCEEDED, video_url="/outputs/x.mp4")
    updated = tm.get(task.id)
    assert updated.status == TaskStatus.SUCCEEDED
    assert updated.video_url == "/outputs/x.mp4"