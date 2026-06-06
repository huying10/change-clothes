import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.config import Settings
from app.core.prompt import build_image_prompt, build_video_prompt
from app.core.storage import Storage
from app.core.task_manager import TaskManager
from app.deps import (
    get_image_provider,
    get_settings,
    get_storage,
    get_task_manager,
    get_video_provider,
)
from app.providers.base import (
    GenOptions,
    ImageGenProvider,
    TaskStatus,
    VideoGenProvider,
)

router = APIRouter()
logger = logging.getLogger("uvicorn.error")

OUTFIT_FIELDS = ["top", "bottom", "shoes", "jewelry", "accessory"]
IMAGE_RETRIES = 2  # Seedream 偶发失败时的总尝试次数


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
    video_provider: VideoGenProvider = Depends(get_video_provider),
    image_provider: ImageGenProvider = Depends(get_image_provider),
):
    """编排两段生成：
    ① Seedream 把「人物 + 所选服饰」合成一张换装图（人物已穿好整套）。
    ② Seedance 仅用 [换装图, 场景图] 两张参考图生成视频，规避参考图数量限制。
    若图片生成失败，则回退用原始人物图作为视频参考。
    """
    outfit = {"top": top, "bottom": bottom, "shoes": shoes,
              "jewelry": jewelry, "accessory": accessory}
    present_outfit = {k: v for k, v in outfit.items() if v is not None}

    task = task_manager.create()
    options = GenOptions(
        resolution=settings.gen_resolution,
        aspect_ratio=settings.gen_aspect_ratio,
        duration=settings.gen_duration,
        mode=settings.gen_mode,
    )

    # 存原始上传
    person_path = storage.save_upload(task.id, "person", person.filename or "person.jpg", await person.read())
    scene_path = storage.save_upload(task.id, "scene", scene.filename or "scene.jpg", await scene.read())
    outfit_paths = []
    for field, upload in present_outfit.items():
        path = storage.save_upload(task.id, field, upload.filename or f"{field}.jpg", await upload.read())
        outfit_paths.append(path)

    # ① Seedream 合成换装定妆照：人物(换装) + 服饰 + 场景 → 人站在场景里的全身定妆照
    image_url = None
    tryon_path = None
    image_error = None
    image_prompt = build_image_prompt(
        list(present_outfit.keys()), with_scene=True, custom=custom_prompt
    )
    image_refs = [person_path, *outfit_paths, scene_path]
    for attempt in range(1, IMAGE_RETRIES + 1):
        try:
            tryon_bytes = image_provider.generate(image_refs, image_prompt, options)
            tryon_path = storage.save_output_image(task.id, tryon_bytes)
            image_url = storage.output_public_url(tryon_path)
            image_error = None
            break
        except Exception as exc:  # noqa: BLE001
            image_error = str(exc)
            logger.warning("Seedream 换装图生成失败(第 %d/%d 次): %s", attempt, IMAGE_RETRIES, exc)
    if tryon_path is None:
        logger.error("Seedream 最终失败，回退原始人物图当首帧；原因: %s", image_error)

    # ② Seedance 单图首帧(i2v)：定妆照(人物已在场景中) → 转身+走动
    first_frame = tryon_path or person_path
    video_refs = [first_frame]
    video_prompt = build_video_prompt(custom=custom_prompt)

    try:
        external_id = video_provider.submit(video_refs, video_prompt, options)
    except Exception as exc:  # noqa: BLE001
        logger.error("Seedance 提交视频任务失败: %s", exc)
        task_manager.update(task.id, status=TaskStatus.FAILED, error=str(exc))
        return {"task_id": task.id, "image_url": image_url, "image_error": image_error}

    task_manager.update(
        task.id, status=TaskStatus.RUNNING, external_id=external_id, prompt=video_prompt
    )
    return {"task_id": task.id, "image_url": image_url, "image_error": image_error}