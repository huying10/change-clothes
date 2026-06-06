from app.config import Settings
from app.providers.base import VideoGenProvider
from app.providers.mock import MockProvider


def get_provider(settings: Settings) -> VideoGenProvider:
    if settings.provider == "mock":
        return MockProvider(delay_seconds=settings.mock_delay_seconds)
    if settings.provider == "volcengine":
        from app.providers.volcengine import VolcengineProvider

        return VolcengineProvider(
            api_key=settings.ark_api_key,
            base_url=settings.ark_base_url,
            model=settings.seedance_model,
        )
    raise ValueError(f"未知 provider: {settings.provider}")


def get_image_provider(settings: Settings):
    if settings.provider == "mock":
        from app.providers.mock import MockImageProvider
        return MockImageProvider(placeholder_path=settings.static_dir / "placeholder.jpg")
    if settings.provider == "volcengine":
        from app.providers.volcengine_image import VolcengineImageProvider
        return VolcengineImageProvider(
            api_key=settings.ark_api_key,
            base_url=settings.ark_base_url,
            model=settings.seedream_model,
            size=settings.image_size,
        )
    raise ValueError(f"未知 provider: {settings.provider}")


def build_image_providers(settings: Settings) -> dict:
    """返回 {模型标签: ImageGenProvider}，用于多模型并行对比。"""
    if settings.provider == "mock":
        from app.providers.mock import MockImageProvider
        return {"Mock": MockImageProvider(placeholder_path=settings.static_dir / "placeholder.jpg")}
    if settings.provider == "volcengine":
        from app.providers.volcengine_image import VolcengineImageProvider
        models = dict(settings.seedream_models)
        if not models and settings.seedream_model:
            models = {"Seedream": settings.seedream_model}
        if not models:
            raise ValueError("未配置 Seedream 模型（SEEDREAM_MODEL 或 SEEDREAM_MODELS）")
        return {
            label: VolcengineImageProvider(
                api_key=settings.ark_api_key,
                base_url=settings.ark_base_url,
                model=mid,
                size=settings.image_size,
            )
            for label, mid in models.items()
        }
    raise ValueError(f"未知 provider: {settings.provider}")