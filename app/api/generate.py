import logging

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.config import Settings
from app.core.prompt import build_image_prompt, build_video_prompt
from app.core.storage import Storage
from app.core.task_manager import TaskManager
from app.deps import (
    get_image_providers,
    get_settings,
    get_storage,
    get_task_manager,
    get_video_provider,
)
from app.providers.base import GenOptions, TaskStatus, VideoGenProvider

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
    image_providers: dict = Depends(get_image_providers),
):
    """编排：
    ① 用配置的一个或多个 Seedream 模型，各自把「人物 + 服饰 + 场景」合成换装定妆照
       （多模型时每个模型一张，前端分 tab 对比）。
    ② 若 ENABLE_VIDEO，则用第一张成功的定妆照当首帧提交 Seedance 视频；否则暂停视频。
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

    image_prompt = build_image_prompt(
        list(present_outfit.keys()), with_scene=True, custom=custom_prompt
    )
    image_refs = [person_path, *outfit_paths, scene_path]

    # ① 各模型并行（顺序）生成换装定妆照
    images: dict[str, str] = {}        # label -> 公网可访问的本地 url
    image_errors: dict[str, str] = {}  # label -> 失败原因
    first_frame_path = None            # 给视频用的首帧（第一张成功的定妆照）
    for label, provider in image_providers.items():
        key = "".join(c if c.isalnum() else "_" for c in label)
        err = None
        for attempt in range(1, IMAGE_RETRIES + 1):
            try:
                data = provider.generate(image_refs, image_prompt, options)
                path = storage.save_output_image(task.id, data, label=key)
                images[label] = storage.output_public_url(path)
                if first_frame_path is None:
                    first_frame_path = path
                err = None
                break
            except Exception as exc:  # noqa: BLE001
                err = str(exc)
                logger.warning("[%s] 换装图生成失败(第 %d/%d 次): %s", label, attempt, IMAGE_RETRIES, exc)
        if label not in images:
            image_errors[label] = err
            logger.error("[%s] 换装图最终失败: %s", label, err)

    # ② 视频（可暂停）
    task_id = None
    if settings.enable_video:
        first_frame = first_frame_path or person_path
        video_prompt = build_video_prompt(custom=custom_prompt)
        try:
            external_id = video_provider.submit([first_frame], video_prompt, options)
            task_manager.update(
                task.id, status=TaskStatus.RUNNING, external_id=external_id, prompt=video_prompt
            )
            task_id = task.id
        except Exception as exc:  # noqa: BLE001
            logger.error("Seedance 提交视频任务失败: %s", exc)
            task_manager.update(task.id, status=TaskStatus.FAILED, error=str(exc))
            task_id = task.id

    return {
        "images": images,
        "image_errors": image_errors,
        "task_id": task_id,
        "video_enabled": settings.enable_video,
    }