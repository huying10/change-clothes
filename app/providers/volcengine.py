import base64
import mimetypes
from pathlib import Path

import httpx

from app.providers.base import (
    GenOptions,
    TaskResult,
    TaskStatus,
    VideoGenProvider,
)

# 火山引擎方舟状态 → 内部状态映射（执行时按文档核对取值）
_STATUS_MAP = {
    "queued": TaskStatus.PENDING,
    "pending": TaskStatus.PENDING,
    "running": TaskStatus.RUNNING,
    "succeeded": TaskStatus.SUCCEEDED,
    "failed": TaskStatus.FAILED,
    "cancelled": TaskStatus.FAILED,
}


def _to_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    b64 = base64.b64encode(Path(path).read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


class VolcengineProvider(VideoGenProvider):
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        if not api_key or not model:
            raise ValueError("VolcengineProvider 需要 ARK_API_KEY 与 SEEDANCE_MODEL")
        self._model = model
        self._base = base_url.rstrip("/")
        self._auth_header = f"Bearer {api_key}"
        self._client = httpx.Client(timeout=60)

    def submit(self, reference_images, prompt: str, options: GenOptions) -> str:
        # 图生视频(i2v)：用换装定妆照当首帧。文本参数对齐官方 i2v 示例。
        text = (
            f"{prompt} --duration {options.duration} "
            "--camerafixed false --watermark false"
        )
        content = [{"type": "text", "text": text}]
        for img in reference_images:
            content.append({
                "type": "image_url",
                "image_url": {"url": _to_data_url(Path(img))},
            })
        resp = self._client.post(
            f"{self._base}/contents/generations/tasks",
            json={"model": self._model, "content": content},
            headers={"Authorization": self._auth_header},
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def poll(self, external_task_id: str) -> TaskResult:
        resp = self._client.get(
            f"{self._base}/contents/generations/tasks/{external_task_id}",
            headers={"Authorization": self._auth_header},
        )
        resp.raise_for_status()
        body = resp.json()
        status = _STATUS_MAP.get(body.get("status", ""), TaskStatus.RUNNING)
        if status == TaskStatus.SUCCEEDED:
            return TaskResult(status, video_url=(body.get("content") or {}).get("video_url"))
        if status == TaskStatus.FAILED:
            err = (body.get("error") or {}).get("message", "生成失败")
            return TaskResult(status, error=err)
        return TaskResult(status)