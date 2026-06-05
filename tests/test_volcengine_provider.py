import httpx

from app.providers.base import GenOptions, TaskStatus
from app.providers.volcengine import VolcengineProvider


def test_submit_posts_task_and_returns_id(tmp_path, monkeypatch):
    img = tmp_path / "p.jpg"
    img.write_bytes(b"img")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/contents/generations/tasks")
        assert request.headers["Authorization"] == "Bearer KEY"
        return httpx.Response(200, json={"id": "ext-123"})

    transport = httpx.MockTransport(handler)
    provider = VolcengineProvider(api_key="KEY", base_url="https://x/api/v3", model="ep-1")
    monkeypatch.setattr(provider, "_client", httpx.Client(transport=transport))

    ext = provider.submit([img], "prompt", GenOptions())
    assert ext == "ext-123"


def test_poll_maps_status(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "succeeded",
                                         "content": {"video_url": "https://v/out.mp4"}})

    transport = httpx.MockTransport(handler)
    provider = VolcengineProvider(api_key="KEY", base_url="https://x/api/v3", model="ep-1")
    monkeypatch.setattr(provider, "_client", httpx.Client(transport=transport))

    result = provider.poll("ext-123")
    assert result.status == TaskStatus.SUCCEEDED
    assert result.video_url == "https://v/out.mp4"


def test_poll_failed_status_carries_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "failed", "error": {"message": "审核拒绝"}})

    transport = httpx.MockTransport(handler)
    provider = VolcengineProvider(api_key="KEY", base_url="https://x/api/v3", model="ep-1")
    monkeypatch.setattr(provider, "_client", httpx.Client(transport=transport))

    result = provider.poll("ext-123")
    assert result.status == TaskStatus.FAILED
    assert "审核拒绝" in result.error