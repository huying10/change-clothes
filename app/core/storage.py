from abc import ABC, abstractmethod
from pathlib import Path


class Storage(ABC):
    @abstractmethod
    def save_upload(self, task_id: str, field: str, filename: str, data: bytes) -> Path: ...

    @abstractmethod
    def save_output(self, task_id: str, data: bytes) -> Path: ...

    @abstractmethod
    def save_output_image(self, task_id: str, data: bytes, label: str = "") -> Path: ...

    @abstractmethod
    def output_public_url(self, path: Path) -> str: ...


class LocalStorage(Storage):
    def __init__(self, uploads_dir: Path, outputs_dir: Path) -> None:
        self.uploads_dir = Path(uploads_dir)
        self.outputs_dir = Path(outputs_dir)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(parents=True, exist_ok=True)

    def save_upload(self, task_id: str, field: str, filename: str, data: bytes) -> Path:
        suffix = Path(filename).suffix or ".jpg"
        task_dir = self.uploads_dir / task_id
        task_dir.mkdir(parents=True, exist_ok=True)
        path = task_dir / f"{field}{suffix}"
        path.write_bytes(data)
        return path

    def save_output(self, task_id: str, data: bytes) -> Path:
        path = self.outputs_dir / f"{task_id}.mp4"
        path.write_bytes(data)
        return path

    def save_output_image(self, task_id: str, data: bytes, label: str = "") -> Path:
        suffix = f"_{label}" if label else ""
        path = self.outputs_dir / f"{task_id}{suffix}.jpg"
        path.write_bytes(data)
        return path

    def output_public_url(self, path: Path) -> str:
        return f"/outputs/{Path(path).name}"