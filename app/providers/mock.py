import time
from pathlib import Path
from uuid import uuid4

from app.providers.base import (
    GenOptions,
    ImageGenProvider,
    TaskResult,
    TaskStatus,
    VideoGenProvider,
)


class MockProvider(VideoGenProvider):
    """零成本占位实现：提交后经过 delay_seconds 返回占位视频。"""

    def __init__(
        self,
        placeholder_video_url: str = "/static/placeholder.mp4",
        delay_seconds: float = 3.0,
    ) -> None:
        self._placeholder = placeholder_video_url
        self._delay = delay_seconds
        self._started: dict[str, float] = {}

    def submit(self, reference_images, prompt, options: GenOptions) -> str:
        task_id = f"mock-{uuid4().hex}"
        self._started[task_id] = time.monotonic()
        return task_id

    def poll(self, external_task_id: str) -> TaskResult:
        started = self._started.get(external_task_id)
        if started is None:
            return TaskResult(TaskStatus.FAILED, error="未知任务")
        if time.monotonic() - started < self._delay:
            return TaskResult(TaskStatus.RUNNING)
        return TaskResult(TaskStatus.SUCCEEDED, video_url=self._placeholder)


class MockImageProvider(ImageGenProvider):
    """零成本占位：返回占位图片的字节。"""

    def __init__(self, placeholder_path) -> None:
        self._path = Path(placeholder_path)

    def generate(self, reference_images, prompt, options: GenOptions) -> bytes:
        return self._path.read_bytes()