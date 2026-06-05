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