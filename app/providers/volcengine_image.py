import base64
import mimetypes
from pathlib import Path

import httpx

from app.providers.base import GenOptions, ImageGenProvider


def _to_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    b64 = base64.b64encode(Path(path).read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


class VolcengineImageProvider(ImageGenProvider):
    """火山方舟 Seedream 图片换装（同步），多参考图图生图。"""

    def __init__(self, api_key: str, base_url: str, model: str, size: str = "2048x2048") -> None:
        if not api_key or not model:
            raise ValueError("VolcengineImageProvider 需要 ARK_API_KEY 与 SEEDREAM_MODEL")
        self._model = model
        self._base = base_url.rstrip("/")
        self._size = size
        self._auth = f"Bearer {api_key}"
        self._client = httpx.Client(timeout=120)

    def generate(self, reference_images, prompt: str, options: GenOptions) -> bytes:
        images = [_to_data_url(Path(p)) for p in reference_images]
        payload = {
            "model": self._model,
            "prompt": prompt,
            "image": images,
            "size": self._size,
            "response_format": "url",
            "stream": False,
            "watermark": False,
            "sequential_image_generation": "disabled",
        }
        resp = self._client.post(
            f"{self._base}/images/generations",
            json=payload,
            headers={"Authorization": self._auth},
        )
        resp.raise_for_status()
        url = resp.json()["data"][0]["url"]
        img = self._client.get(url)  # TOS 公网签名链接，无需鉴权
        img.raise_for_status()
        return img.content