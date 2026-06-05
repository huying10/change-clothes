import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.storage import Storage
from app.core.task_manager import TaskManager
from app.deps import get_storage, get_task_manager, get_video_provider
from app.providers.base import TaskStatus, VideoGenProvider

router = APIRouter()

TERMINAL = {TaskStatus.SUCCEEDED, TaskStatus.FAILED}


@router.get("/api/tasks/{task_id}")
def get_task(
    task_id: str,
    task_manager: TaskManager = Depends(get_task_manager),
    provider: VideoGenProvider = Depends(get_video_provider),
    storage: Storage = Depends(get_storage),
):
    task = task_manager.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status not in TERMINAL and task.external_id:
        result = provider.poll(task.external_id)
        if result.status == TaskStatus.SUCCEEDED:
            video_url = result.video_url or ""
            if video_url.startswith("http"):
                data = httpx.get(video_url, timeout=60).content
                path = storage.save_output(task.id, data)
                video_url = storage.output_public_url(path)
            task_manager.update(task.id, status=TaskStatus.SUCCEEDED, video_url=video_url)
        elif result.status == TaskStatus.FAILED:
            task_manager.update(task.id, status=TaskStatus.FAILED, error=result.error)
        else:
            task_manager.update(task.id, status=result.status)

    task = task_manager.get(task_id)
    return {
        "id": task.id,
        "status": task.status.value,
        "video_url": task.video_url,
        "error": task.error,
    }