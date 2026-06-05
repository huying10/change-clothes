import httpx

from app.providers.base import GenOptions
from app.providers.volcengine_image import VolcengineImageProvider


def test_generate_posts_and_downloads_image(tmp_path, monkeypatch):
    img = tmp_path / "p.jpg"
    img.write_bytes(b"refimg")

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/images/generations"):
            assert request.headers["Authorization"] == "Bearer KEY"
            return httpx.Response(200, json={"data": [{"url": "https://img/out.jpg"}]})
        # 下载图片
        return httpx.Response(200, content=b"PNGDATA")

    transport = httpx.MockTransport(handler)
    provider = VolcengineImageProvider(api_key="KEY", base_url="https://x/api/v3", model="ep-img")
    monkeypatch.setattr(provider, "_client", httpx.Client(transport=transport))

    data = provider.generate([img], "穿上这件衣服", GenOptions())
    assert data == b"PNGDATA"