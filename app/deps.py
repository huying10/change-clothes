from functools import lru_cache

from app.config import Settings
from app.core.storage import LocalStorage, Storage
from app.core.task_manager import TaskManager
from app.providers.base import VideoGenProvider
from app.providers.factory import get_provider


@lru_cache
def get_settings() -> Settings:
    return Settings()


@lru_cache
def get_storage() -> Storage:
    s = get_settings()
    return LocalStorage(uploads_dir=s.uploads_dir, outputs_dir=s.outputs_dir)


@lru_cache
def get_task_manager() -> TaskManager:
    return TaskManager()


@lru_cache
def get_video_provider() -> VideoGenProvider:
    return get_provider(get_settings())


@lru_cache
def get_image_provider():
    from app.providers.factory import get_image_provider as _f
    return _f(get_settings())


@lru_cache
def get_image_providers() -> dict:
    from app.providers.factory import build_image_providers
    return build_image_providers(get_settings())