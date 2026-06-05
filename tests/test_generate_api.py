import io

from fastapi.testclient import TestClient

from app.main import create_app


def _img(name="x.jpg"):
    return (name, io.BytesIO(b"fake-image-bytes"), "image/jpeg")


def _client():
    return TestClient(create_app())


def test_generate_requires_person_and_scene():
    client = _client()
    resp = client.post("/api/generate", files={"top": _img()})
    assert resp.status_code == 422  # 缺必填字段


def test_generate_returns_task_id():
    client = _client()
    resp = client.post(
        "/api/generate",
        files={"person": _img("person.jpg"), "scene": _img("scene.jpg"), "top": _img("top.jpg")},
    )
    assert resp.status_code == 200
    assert resp.json()["task_id"]


def test_generate_rejects_too_many_reference_images():
    client = _client()
    files = [
        ("person", _img("person.jpg")),
        ("scene", _img("scene.jpg")),
        ("top", _img("top.jpg")),
        ("bottom", _img("bottom.jpg")),
        ("shoes", _img("shoes.jpg")),
        ("jewelry", _img("jewelry.jpg")),
        ("accessory", _img("accessory.jpg")),
    ]
    resp = client.post("/api/generate", files=files)
    assert resp.status_code == 200