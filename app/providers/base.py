from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass
class GenOptions:
    resolution: str = "480p"      # 480p | 720p | 1080p
    aspect_ratio: str = "9:16"
    duration: int = 10            # 秒
    mode: str = "fast"            # fast | standard


@dataclass
class TaskResult:
    status: TaskStatus
    video_url: str | None = None
    error: str | None = None


class VideoGenProvider(ABC):
    """视频生成模型适配接口。火山引擎 / fal / mock 各自实现。"""

    @abstractmethod
    def submit(
        self,
        reference_images: list[Path],
        prompt: str,
        options: GenOptions,
    ) -> str:
        """提交生成任务，返回外部任务 ID。"""

    @abstractmethod
    def poll(self, external_task_id: str) -> TaskResult:
        """查询外部任务状态/结果。"""