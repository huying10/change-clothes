from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings
from app.core.prompt import build_prompt
from app.core.storage import Storage
from app.core.task_manager import TaskManager
from app.deps import get_settings, get_storage, get_task_manager, get_video_provider
from app.providers.base import GenOptions, TaskStatus, VideoGenProvider

router = APIRouter()

OPTIONAL_FIELDS = ["top", "bottom", "shoes", "jewelry", "accessory"]
MAX_REFERENCE_IMAGES = 9


@router.post("/api/generate")
async def generate(
    person: UploadFile = File(...),
    scene: UploadFile = File(...),
    top: UploadFile | None = File(None),
    bottom: UploadFile | None = File(None),
    shoes: UploadFile | None = File(None),
    jewelry: UploadFile | None = File(None),
    accessory: UploadFile | None = File(None),
    custom_prompt: str | None = Form(None),
    settings: Settings = Depends(get_settings),
    storage: Storage = Depends(get_storage),
    task_manager: TaskManager = Depends(get_task_manager),
    provider: VideoGenProvider = Depends(get_video_provider),
):
    optional = {"top": top, "bottom": bottom, "shoes": shoes,
                "jewelry": jewelry, "accessory": accessory}
    present_optional = {k: v for k, v in optional.items() if v is not None}

    total_refs = 2 + len(present_optional)  # person + scene + 单品
    if total_refs > MAX_REFERENCE_IMAGES:
        raise HTTPException(
            status_code=400,
            detail=f"参考图总数 {total_refs} 超过上限 {MAX_REFERENCE_IMAGES}",
        )

    task = task_manager.create()

    ref_paths = []
    for field, upload in [("person", person), ("scene", scene), *present_optional.items()]:
        data = await upload.read()
        path = storage.save_upload(task.id, field, upload.filename or f"{field}.jpg", data)
        ref_paths.append(path)

    prompt = build_prompt(list(present_optional.keys()), custom=custom_prompt)
    options = GenOptions(
        resolution=settings.gen_resolution,
        aspect_ratio=settings.gen_aspect_ratio,
        duration=settings.gen_duration,
        mode=settings.gen_mode,
    )

    try:
        external_id = provider.submit(ref_paths, prompt, options)
    except Exception as exc:  # noqa: BLE001 - 统一转任务失败
        task_manager.update(task.id, status=TaskStatus.FAILED, error=str(exc))
        return {"task_id": task.id}

    task_manager.update(
        task.id, status=TaskStatus.RUNNING, external_id=external_id, prompt=prompt
    )
    return {"task_id": task.id}