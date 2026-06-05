import io

from fastapi.testclient import TestClient

from app.main import create_app


def _img(name="x.jpg"):
    return (name, io.BytesIO(b"fake"), "image/jpeg")


def test_unknown_task_returns_404():
    client = TestClient(create_app())
    resp = client.get("/api/tasks/nope")
    assert resp.status_code == 404


def test_task_reaches_succeeded_with_mock(monkeypatch):
    monkeypatch.setenv("MOCK_DELAY_SECONDS", "0")
    from app import deps
    deps.get_settings.cache_clear()
    deps.get_video_provider.cache_clear()
    deps.get_task_manager.cache_clear()
    deps.get_storage.cache_clear()

    client = TestClient(create_app())
    gen = client.post(
        "/api/generate",
        files={"person": _img("person.jpg"), "scene": _img("scene.jpg")},
    )
    task_id = gen.json()["task_id"]

    resp = client.get(f"/api/tasks/{task_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "succeeded"
    assert body["video_url"] == "/static/placeholder.mp4"