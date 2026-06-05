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
    from app.providers.base import ImageGenProvider  # noqa: F401
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