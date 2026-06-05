from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.config import Settings
from app.core.prompt import build_image_prompt
from app.core.storage import Storage
from app.deps import get_image_provider, get_settings, get_storage
from app.providers.base import GenOptions, ImageGenProvider

router = APIRouter()

OPTIONAL_FIELDS = ["top", "bottom", "shoes", "jewelry", "accessory", "scene"]


@router.post("/api/generate-image")
async def generate_image(
    person: UploadFile = File(...),
    top: UploadFile | None = File(None),
    bottom: UploadFile | None = File(None),
    shoes: UploadFile | None = File(None),
    jewelry: UploadFile | None = File(None),
    accessory: UploadFile | None = File(None),
    scene: UploadFile | None = File(None),
    custom_prompt: str | None = Form(None),
    settings: Settings = Depends(get_settings),
    storage: Storage = Depends(get_storage),
    provider: ImageGenProvider = Depends(get_image_provider),
):
    optional = {"top": top, "bottom": bottom, "shoes": shoes,
                "jewelry": jewelry, "accessory": accessory, "scene": scene}
    present = {k: v for k, v in optional.items() if v is not None}

    task_id = uuid4().hex
    refs = []
    for field, upload in [("person", person), *present.items()]:
        data = await upload.read()
        path = storage.save_upload(task_id, f"img_{field}", upload.filename or f"{field}.jpg", data)
        refs.append(path)

    # 提示词只列出服饰类（scene 不算服饰）
    item_fields = [f for f in present.keys() if f != "scene"]
    prompt = build_image_prompt(item_fields, custom=custom_prompt)
    options = GenOptions(resolution=settings.gen_resolution, aspect_ratio=settings.gen_aspect_ratio)

    try:
        img_bytes = provider.generate(refs, prompt, options)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"图片生成失败: {exc}")

    out_path = storage.save_output_image(task_id, img_bytes)
    return {"image_url": storage.output_public_url(out_path)}