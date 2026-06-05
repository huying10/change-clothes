from dataclasses import dataclass
from uuid import uuid4

from app.providers.base import TaskStatus


@dataclass
class Task:
    id: str
    status: TaskStatus = TaskStatus.PENDING
    external_id: str | None = None
    video_url: str | None = None
    error: str | None = None
    prompt: str = ""


class TaskManager:
    """内存任务表。Demo 用；产品化可替换为 Celery + Redis。"""

    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}

    def create(self) -> Task:
        task = Task(id=uuid4().hex)
        self._tasks[task.id] = task
        return task

    def get(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def update(self, task_id: str, **fields) -> None:
        task = self._tasks[task_id]
        for key, value in fields.items():
            setattr(task, key, value)