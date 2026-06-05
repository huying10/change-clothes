from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=PROJECT_ROOT / ".env", extra="ignore")

    provider: str = "mock"

    ark_api_key: str = ""
    ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    seedance_model: str = ""
    seedream_model: str = ""
    image_size: str = "2048x2048"

    mock_delay_seconds: float = 3.0

    gen_resolution: str = "480p"
    gen_aspect_ratio: str = "9:16"
    gen_duration: int = 10
    gen_mode: str = "fast"

    uploads_dir: Path = PROJECT_ROOT / "uploads"
    outputs_dir: Path = PROJECT_ROOT / "outputs"
    static_dir: Path = PROJECT_ROOT / "static"

    def ensure_dirs(self) -> None:
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)
        self.static_dir.mkdir(parents=True, exist_ok=True)
