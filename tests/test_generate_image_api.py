import io

from fastapi.testclient import TestClient

from app.main import create_app


def _img(name="x.jpg"):
    return (name, io.BytesIO(b"fake"), "image/jpeg")


def test_generate_image_requires_person():
    client = TestClient(create_app())
    resp = client.post("/api/generate-image", files={"top": _img()})
    assert resp.status_code == 422


def test_generate_image_returns_image_url():
    client = TestClient(create_app())
    resp = client.post(
        "/api/generate-image",
        files={"person": _img("person.jpg"), "top": _img("top.jpg")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["image_url"].startswith("/outputs/")
    assert body["image_url"].endswith(".jpg")