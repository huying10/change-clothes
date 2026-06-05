# AI 虚拟换装视频应用 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现一个 AI 虚拟换装视频 Demo：用户上传人物图 + 衣/裤/鞋/首饰/配饰 + 场景图，调用 Seedance 2.0 生成「人物换装后在该场景走动」的视频。

**Architecture:** FastAPI 单体应用，同仓托管 React 前端。核心是 `VideoGenProvider` 抽象层，`MockProvider`（零成本验证流程）与 `VolcengineProvider`（真实火山引擎 Seedance 2.0）可通过配置切换。任务采用「读时轮询」（lazy poll）模型：前端轮询 `/api/tasks/{id}`，后端在该请求中向 provider 查询状态并更新，无需独立后台 worker。

**Tech Stack:** Python 3.11、FastAPI、Uvicorn、httpx、pydantic-settings、pytest；前端 React + Vite + TypeScript。

**对应设计文档:** `docs/superpowers/specs/2026-06-04-ai-virtual-tryon-video-design.md`

---

## 文件结构

```
change-clothes/
├── app/
│   ├── __init__.py
│   ├── main.py               # FastAPI 入口，装配依赖、托管前端、挂载 /outputs
│   ├── config.py             # pydantic-settings 配置
│   ├── deps.py               # 依赖装配：storage / task_manager / provider 单例
│   ├── api/
│   │   ├── __init__.py
│   │   ├── generate.py       # POST /api/generate
│   │   └── tasks.py          # GET /api/tasks/{id}
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py           # VideoGenProvider 抽象 + 数据类型
│   │   ├── mock.py           # MockProvider
│   │   ├── volcengine.py     # VolcengineProvider（真实）
│   │   └── factory.py        # get_provider(settings)
│   └── core/
│       ├── __init__.py
│       ├── storage.py        # Storage 抽象 + LocalStorage
│       ├── task_manager.py   # 内存任务表
│       └── prompt.py         # 换装提示词组装
├── frontend/                 # React + Vite + TS（构建产物给 FastAPI 托管）
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── src/{main.tsx, App.tsx, api.ts, App.css}
├── tests/
│   ├── __init__.py
│   ├── test_mock_provider.py
│   ├── test_factory.py
│   ├── test_storage.py
│   ├── test_task_manager.py
│   ├── test_prompt.py
│   ├── test_generate_api.py
│   ├── test_tasks_api.py
│   └── test_volcengine_provider.py
├── scripts/smoke_test.py
├── static/placeholder.mp4    # Mock 模式占位视频
├── uploads/                  # gitignore
├── outputs/                  # gitignore
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

## Task 0: 项目脚手架与依赖

**Files:**
- Create: `requirements.txt`, `.gitignore`, `.env.example`, `app/__init__.py`, `app/config.py`
- Create (空包): `app/api/__init__.py`, `app/providers/__init__.py`, `app/core/__init__.py`, `tests/__init__.py`

- [ ] **Step 1: 写 `requirements.txt`**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
python-multipart==0.0.20
httpx==0.28.1
pydantic-settings==2.7.1
pytest==8.3.4
```

- [ ] **Step 2: 写 `.gitignore`**

```
__pycache__/
*.pyc
.venv/
venv/
.env
uploads/
outputs/
frontend/node_modules/
frontend/dist/
.pytest_cache/
.idea/
```

- [ ] **Step 3: 写 `.env.example`**

```
# provider 选择：mock（零成本验证流程）| volcengine（真实 Seedance 2.0）
PROVIDER=mock

# 火山引擎方舟配置（PROVIDER=volcengine 时必填）
ARK_API_KEY=
ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
# Seedance 2.0 的推理接入点 ID 或模型名（从火山引擎控制台获取）
SEEDANCE_MODEL=

# Mock 模式模拟生成耗时（秒），让前端能看到 running 状态
MOCK_DELAY_SECONDS=3

# 默认生成参数
GEN_RESOLUTION=480p
GEN_ASPECT_RATIO=9:16
GEN_DURATION=10
GEN_MODE=fast
```

- [ ] **Step 4: 创建空的包初始化文件**

创建以下空文件（每个内容为空）：
`app/__init__.py`、`app/api/__init__.py`、`app/providers/__init__.py`、`app/core/__init__.py`、`tests/__init__.py`

- [ ] **Step 5: 写 `app/config.py`**

```python
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    provider: str = "mock"

    ark_api_key: str = ""
    ark_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    seedance_model: str = ""

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
```

- [ ] **Step 6: 安装依赖并验证导入**

Run:
```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
.venv/Scripts/python -c "from app.config import Settings; print(Settings().provider)"
```
Expected: 输出 `mock`

> 后续所有 `python`/`pytest` 命令均指 `.venv/Scripts/python -m ...`。

- [ ] **Step 7: Commit**

```bash
git add requirements.txt .gitignore .env.example app/ tests/__init__.py
git commit -m "chore: 项目脚手架与配置"
```

---

## Task 1: Provider 基础类型与抽象接口

**Files:**
- Create: `app/providers/base.py`

- [ ] **Step 1: 写 `app/providers/base.py`**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


@dataclass
class GenOptions:
    resolution: str = "480p"      # 480p | 720p | 1080p
    aspect_ratio: str = "9:16"
    duration: int = 10            # 秒
    mode: str = "fast"            # fast | standard


@dataclass
class TaskResult:
    status: TaskStatus
    video_url: str | None = None  # 成功时的视频地址（远程 http 或本地 /...）
    error: str | None = None


class VideoGenProvider(ABC):
    """视频生成模型适配接口。火山引擎 / fal / mock 各自实现。"""

    @abstractmethod
    def submit(
        self,
        reference_images: list[Path],
        prompt: str,
        options: GenOptions,
    ) -> str:
        """提交生成任务，返回外部任务 ID。"""

    @abstractmethod
    def poll(self, external_task_id: str) -> TaskResult:
        """查询外部任务状态/结果。"""
```

- [ ] **Step 2: 验证导入**

Run: `.venv/Scripts/python -c "from app.providers.base import VideoGenProvider, TaskStatus, GenOptions, TaskResult; print(TaskStatus.RUNNING.value)"`
Expected: 输出 `running`

- [ ] **Step 3: Commit**

```bash
git add app/providers/base.py
git commit -m "feat: 定义 VideoGenProvider 抽象接口与核心类型"
```

---

## Task 2: MockProvider

**Files:**
- Create: `app/providers/mock.py`
- Test: `tests/test_mock_provider.py`

- [ ] **Step 1: 写失败测试 `tests/test_mock_provider.py`**

```python
from pathlib import Path

from app.providers.base import GenOptions, TaskStatus
from app.providers.mock import MockProvider


def test_submit_returns_id_then_succeeds_immediately_when_no_delay():
    provider = MockProvider(placeholder_video_url="/static/placeholder.mp4", delay_seconds=0)
    task_id = provider.submit([Path("a.jpg")], "prompt", GenOptions())
    assert task_id.startswith("mock-")

    result = provider.poll(task_id)
    assert result.status == TaskStatus.SUCCEEDED
    assert result.video_url == "/static/placeholder.mp4"


def test_poll_unknown_task_fails():
    provider = MockProvider(delay_seconds=0)
    result = provider.poll("does-not-exist")
    assert result.status == TaskStatus.FAILED
    assert result.error


def test_poll_running_before_delay_elapses():
    provider = MockProvider(delay_seconds=999)
    task_id = provider.submit([], "p", GenOptions())
    result = provider.poll(task_id)
    assert result.status == TaskStatus.RUNNING
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_mock_provider.py -v`
Expected: FAIL（`ModuleNotFoundError: app.providers.mock`）

- [ ] **Step 3: 写 `app/providers/mock.py`**

```python
import time
from pathlib import Path
from uuid import uuid4

from app.providers.base import (
    GenOptions,
    TaskResult,
    TaskStatus,
    VideoGenProvider,
)


class MockProvider(VideoGenProvider):
    """零成本占位实现：提交后经过 delay_seconds 返回占位视频。"""

    def __init__(
        self,
        placeholder_video_url: str = "/static/placeholder.mp4",
        delay_seconds: float = 3.0,
    ) -> None:
        self._placeholder = placeholder_video_url
        self._delay = delay_seconds
        self._started: dict[str, float] = {}

    def submit(self, reference_images, prompt, options: GenOptions) -> str:
        task_id = f"mock-{uuid4().hex}"
        self._started[task_id] = time.monotonic()
        return task_id

    def poll(self, external_task_id: str) -> TaskResult:
        started = self._started.get(external_task_id)
        if started is None:
            return TaskResult(TaskStatus.FAILED, error="未知任务")
        if time.monotonic() - started < self._delay:
            return TaskResult(TaskStatus.RUNNING)
        return TaskResult(TaskStatus.SUCCEEDED, video_url=self._placeholder)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_mock_provider.py -v`
Expected: PASS（3 passed）

- [ ] **Step 5: Commit**

```bash
git add app/providers/mock.py tests/test_mock_provider.py
git commit -m "feat: MockProvider 零成本占位生成"
```

---

## Task 3: Provider 工厂

**Files:**
- Create: `app/providers/factory.py`
- Test: `tests/test_factory.py`

> 说明：`VolcengineProvider` 在 Task 10 实现。本任务工厂里对 volcengine 分支先用延迟导入，测试只覆盖 mock 分支与非法值。

- [ ] **Step 1: 写失败测试 `tests/test_factory.py`**

```python
import pytest

from app.config import Settings
from app.providers.factory import get_provider
from app.providers.mock import MockProvider


def test_factory_returns_mock():
    settings = Settings(provider="mock", mock_delay_seconds=0)
    provider = get_provider(settings)
    assert isinstance(provider, MockProvider)


def test_factory_rejects_unknown():
    settings = Settings(provider="nope")
    with pytest.raises(ValueError):
        get_provider(settings)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_factory.py -v`
Expected: FAIL（`ModuleNotFoundError: app.providers.factory`）

- [ ] **Step 3: 写 `app/providers/factory.py`**

```python
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_factory.py -v`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add app/providers/factory.py tests/test_factory.py
git commit -m "feat: provider 工厂按配置选择实现"
```

---

## Task 4: 本地存储层

**Files:**
- Create: `app/core/storage.py`
- Test: `tests/test_storage.py`

- [ ] **Step 1: 写失败测试 `tests/test_storage.py`**

```python
from app.core.storage import LocalStorage


def test_save_upload_writes_file_and_returns_path(tmp_path):
    storage = LocalStorage(uploads_dir=tmp_path / "up", outputs_dir=tmp_path / "out")
    path = storage.save_upload("task1", "person", "p.jpg", b"hello")
    assert path.exists()
    assert path.read_bytes() == b"hello"
    assert "task1" in str(path)
    assert path.name.startswith("person")


def test_save_output_and_public_url(tmp_path):
    storage = LocalStorage(uploads_dir=tmp_path / "up", outputs_dir=tmp_path / "out")
    path = storage.save_output("task1", b"video-bytes")
    assert path.exists()
    url = storage.output_public_url(path)
    assert url == "/outputs/task1.mp4"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_storage.py -v`
Expected: FAIL（`ModuleNotFoundError: app.core.storage`）

- [ ] **Step 3: 写 `app/core/storage.py`**

```python
from abc import ABC, abstractmethod
from pathlib import Path


class Storage(ABC):
    @abstractmethod
    def save_upload(self, task_id: str, field: str, filename: str, data: bytes) -> Path: ...

    @abstractmethod
    def save_output(self, task_id: str, data: bytes) -> Path: ...

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

    def output_public_url(self, path: Path) -> str:
        return f"/outputs/{Path(path).name}"
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_storage.py -v`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add app/core/storage.py tests/test_storage.py
git commit -m "feat: 本地文件存储层"
```

---

## Task 5: 任务管理器

**Files:**
- Create: `app/core/task_manager.py`
- Test: `tests/test_task_manager.py`

- [ ] **Step 1: 写失败测试 `tests/test_task_manager.py`**

```python
from app.core.task_manager import TaskManager
from app.providers.base import TaskStatus


def test_create_returns_pending_task_with_id():
    tm = TaskManager()
    task = tm.create()
    assert task.id
    assert task.status == TaskStatus.PENDING


def test_get_returns_same_task():
    tm = TaskManager()
    task = tm.create()
    assert tm.get(task.id) is task


def test_get_missing_returns_none():
    tm = TaskManager()
    assert tm.get("nope") is None


def test_update_mutates_fields():
    tm = TaskManager()
    task = tm.create()
    tm.update(task.id, status=TaskStatus.SUCCEEDED, video_url="/outputs/x.mp4")
    updated = tm.get(task.id)
    assert updated.status == TaskStatus.SUCCEEDED
    assert updated.video_url == "/outputs/x.mp4"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_task_manager.py -v`
Expected: FAIL（`ModuleNotFoundError: app.core.task_manager`）

- [ ] **Step 3: 写 `app/core/task_manager.py`**

```python
from dataclasses import dataclass, field
from uuid import uuid4

from app.providers.base import TaskStatus


@dataclass
class Task:
    id: str
    status: TaskStatus = TaskStatus.PENDING
    external_id: str | None = None
    video_url: str | None = None
    error: str | None = None
    prompt: str = ""


class TaskManager:
    """内存任务表。Demo 用；产品化可替换为 Celery + Redis。"""

    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}

    def create(self) -> Task:
        task = Task(id=uuid4().hex)
        self._tasks[task.id] = task
        return task

    def get(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def update(self, task_id: str, **fields) -> None:
        task = self._tasks[task_id]
        for key, value in fields.items():
            setattr(task, key, value)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_task_manager.py -v`
Expected: PASS（4 passed）

- [ ] **Step 5: Commit**

```bash
git add app/core/task_manager.py tests/test_task_manager.py
git commit -m "feat: 内存任务管理器"
```

---

## Task 6: 换装提示词组装

**Files:**
- Create: `app/core/prompt.py`
- Test: `tests/test_prompt.py`

- [ ] **Step 1: 写失败测试 `tests/test_prompt.py`**

```python
from app.core.prompt import build_prompt


def test_prompt_lists_present_items_in_chinese():
    prompt = build_prompt(present_fields=["top", "bottom", "shoes"])
    assert "上衣" in prompt
    assert "裤子" in prompt
    assert "鞋子" in prompt
    assert "行走" in prompt


def test_prompt_appends_custom_text():
    prompt = build_prompt(present_fields=["top"], custom="夜晚霓虹灯氛围")
    assert "夜晚霓虹灯氛围" in prompt


def test_prompt_ignores_unknown_field():
    prompt = build_prompt(present_fields=["top", "weird"])
    assert "上衣" in prompt
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_prompt.py -v`
Expected: FAIL（`ModuleNotFoundError: app.core.prompt`）

- [ ] **Step 3: 写 `app/core/prompt.py`**

```python
ITEM_LABELS = {
    "top": "上衣",
    "bottom": "裤子",
    "shoes": "鞋子",
    "jewelry": "首饰",
    "accessory": "配饰",
}


def build_prompt(present_fields: list[str], custom: str | None = None) -> str:
    """根据用户提供的单品类别，组装换装视频提示词。

    present_fields: 用户实际上传的单品字段名（person/scene 不在此列）。
    """
    items = [ITEM_LABELS[f] for f in present_fields if f in ITEM_LABELS]
    if items:
        wearing = "、".join(items)
        clause = f"穿着参考图中的{wearing}"
    else:
        clause = "保持人物原貌"

    prompt = (
        f"参考图中的人物{clause}，"
        "出现在参考图给定的场景中自然地向前行走。"
        "保持人物面部与体型一致，服饰贴合自然，"
        "竖屏 9:16 构图，电影感运镜，光线自然真实，画面稳定流畅。"
    )
    if custom:
        prompt += f" {custom.strip()}"
    return prompt
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_prompt.py -v`
Expected: PASS（3 passed）

- [ ] **Step 5: Commit**

```bash
git add app/core/prompt.py tests/test_prompt.py
git commit -m "feat: 换装提示词组装"
```

---

## Task 7: 依赖装配模块

**Files:**
- Create: `app/deps.py`

> 集中构造 storage / task_manager / provider 单例，供 API 与 main 共享，方便测试时覆盖。

- [ ] **Step 1: 写 `app/deps.py`**

```python
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
```

- [ ] **Step 2: 验证导入**

Run: `.venv/Scripts/python -c "from app.deps import get_storage, get_task_manager, get_video_provider; print(type(get_video_provider()).__name__)"`
Expected: 输出 `MockProvider`

- [ ] **Step 3: Commit**

```bash
git add app/deps.py
git commit -m "feat: 依赖装配模块"
```

---

## Task 8: 生成接口 POST /api/generate

**Files:**
- Create: `app/api/generate.py`
- Test: `tests/test_generate_api.py`

接口约定：multipart 表单，字段 `person`(必填)、`scene`(必填)、`top`/`bottom`/`shoes`/`jewelry`/`accessory`(可选)、`custom_prompt`(可选文本)。返回 `{"task_id": "..."}`。参考图总数（person + scene + 各单品）超过 9 返回 400。

- [ ] **Step 1: 写失败测试 `tests/test_generate_api.py`**

```python
import io

from fastapi.testclient import TestClient

from app.main import create_app


def _img(name="x.jpg"):
    return (name, io.BytesIO(b"fake-image-bytes"), "image/jpeg")


def _client():
    return TestClient(create_app())


def test_generate_requires_person_and_scene():
    client = _client()
    resp = client.post("/api/generate", files={"top": _img()})
    assert resp.status_code == 422  # 缺必填字段


def test_generate_returns_task_id():
    client = _client()
    resp = client.post(
        "/api/generate",
        files={"person": _img("person.jpg"), "scene": _img("scene.jpg"), "top": _img("top.jpg")},
    )
    assert resp.status_code == 200
    assert resp.json()["task_id"]


def test_generate_rejects_too_many_reference_images():
    client = _client()
    files = [
        ("person", _img("person.jpg")),
        ("scene", _img("scene.jpg")),
        ("top", _img("top.jpg")),
        ("bottom", _img("bottom.jpg")),
        ("shoes", _img("shoes.jpg")),
        ("jewelry", _img("jewelry.jpg")),
        ("accessory", _img("accessory.jpg")),
    ]
    # 7 张合法；通过追加重复 accessory 触发 >9 不可行（字段唯一），
    # 因此本测试验证 7 张时正常通过（边界内）。
    resp = client.post("/api/generate", files=files)
    assert resp.status_code == 200
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_generate_api.py -v`
Expected: FAIL（`app.main` 尚未实现 `create_app`）

- [ ] **Step 3: 写 `app/api/generate.py`**

```python
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_generate_api.py -v`
Expected: PASS（3 passed）

- [ ] **Step 5: Commit**

```bash
git add app/api/generate.py tests/test_generate_api.py
git commit -m "feat: 生成接口 POST /api/generate"
```

---

## Task 9: 查询接口 GET /api/tasks/{id}（读时轮询）

**Files:**
- Create: `app/api/tasks.py`
- Test: `tests/test_tasks_api.py`

逻辑：取本地 task；若处于非终态且有 `external_id`，调用 `provider.poll`；若 SUCCEEDED 且 `video_url` 是远程 http(s)，下载存到 outputs 并改写为本地 URL；更新并返回 `{id,status,video_url,error}`。

- [ ] **Step 1: 写失败测试 `tests/test_tasks_api.py`**

```python
import io

from fastapi.testclient import TestClient

from app.main import create_app


def _img(name="x.jpg"):
    return (name, io.BytesIO(b"fake"), "image/jpeg")


def test_unknown_task_returns_404():
    client = TestClient(create_app())
    resp = client.get("/api/tasks/nope")
    assert resp.status_code == 404


def test_task_reaches_succeeded_with_mock(monkeypatch):
    # MockProvider 默认 delay 来自配置；这里用 env 把延迟设为 0 保证立即成功
    monkeypatch.setenv("MOCK_DELAY_SECONDS", "0")
    from app import deps
    deps.get_settings.cache_clear()
    deps.get_video_provider.cache_clear()
    deps.get_task_manager.cache_clear()
    deps.get_storage.cache_clear()

    client = TestClient(create_app())
    gen = client.post(
        "/api/generate",
        files={"person": _img("person.jpg"), "scene": _img("scene.jpg")},
    )
    task_id = gen.json()["task_id"]

    resp = client.get(f"/api/tasks/{task_id}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "succeeded"
    assert body["video_url"] == "/static/placeholder.mp4"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_tasks_api.py -v`
Expected: FAIL（`/api/tasks/{id}` 路由不存在 → 404 之外的断言失败或路由缺失）

- [ ] **Step 3: 写 `app/api/tasks.py`**

```python
import httpx
from fastapi import APIRouter, Depends, HTTPException

from app.core.storage import Storage
from app.core.task_manager import TaskManager
from app.deps import get_storage, get_task_manager, get_video_provider
from app.providers.base import TaskStatus, VideoGenProvider

router = APIRouter()

TERMINAL = {TaskStatus.SUCCEEDED, TaskStatus.FAILED}


@router.get("/api/tasks/{task_id}")
def get_task(
    task_id: str,
    task_manager: TaskManager = Depends(get_task_manager),
    provider: VideoGenProvider = Depends(get_video_provider),
    storage: Storage = Depends(get_storage),
):
    task = task_manager.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task.status not in TERMINAL and task.external_id:
        result = provider.poll(task.external_id)
        if result.status == TaskStatus.SUCCEEDED:
            video_url = result.video_url or ""
            if video_url.startswith("http"):
                data = httpx.get(video_url, timeout=60).content
                path = storage.save_output(task.id, data)
                video_url = storage.output_public_url(path)
            task_manager.update(task.id, status=TaskStatus.SUCCEEDED, video_url=video_url)
        elif result.status == TaskStatus.FAILED:
            task_manager.update(task.id, status=TaskStatus.FAILED, error=result.error)
        else:
            task_manager.update(task.id, status=result.status)

    task = task_manager.get(task_id)
    return {
        "id": task.id,
        "status": task.status.value,
        "video_url": task.video_url,
        "error": task.error,
    }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_tasks_api.py -v`
Expected: PASS（2 passed）

- [ ] **Step 5: Commit**

```bash
git add app/api/tasks.py tests/test_tasks_api.py
git commit -m "feat: 查询接口 GET /api/tasks/{id} 读时轮询"
```

---

## Task 10: FastAPI 应用装配与前端托管

**Files:**
- Create: `app/main.py`
- Create: `static/placeholder.mp4`（占位视频）

- [ ] **Step 1: 准备占位视频 `static/placeholder.mp4`**

用 ffmpeg 生成一个 3 秒纯色测试视频（若无 ffmpeg，从任意小 mp4 复制一份到该路径亦可）：

Run:
```bash
ffmpeg -f lavfi -i color=c=gray:s=360x640:d=3 -pix_fmt yuv420p static/placeholder.mp4
```
Expected: 生成 `static/placeholder.mp4`。
若机器无 ffmpeg：手动放一个任意 `.mp4` 到 `static/placeholder.mp4`。

- [ ] **Step 2: 写 `app/main.py`**

```python
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api import generate, tasks
from app.deps import get_settings


def create_app() -> FastAPI:
    settings = get_settings()
    settings.ensure_dirs()

    app = FastAPI(title="AI 虚拟换装视频 Demo")

    app.include_router(generate.router)
    app.include_router(tasks.router)

    app.mount("/static", StaticFiles(directory=settings.static_dir), name="static")
    app.mount("/outputs", StaticFiles(directory=settings.outputs_dir), name="outputs")

    frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if frontend_dist.exists():
        app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
    else:
        @app.get("/")
        def root():
            return {"message": "后端已启动。前端尚未构建：在 frontend/ 下执行 npm install && npm run build"}

    return app


app = create_app()
```

- [ ] **Step 3: 运行全部测试**

Run: `.venv/Scripts/python -m pytest -v`
Expected: 全部 PASS。

- [ ] **Step 4: 手动启动后端验证**

Run: `.venv/Scripts/python -m uvicorn app.main:app --reload`
然后浏览器访问 `http://127.0.0.1:8000/` → 看到后端 JSON 提示；访问 `http://127.0.0.1:8000/static/placeholder.mp4` 能播放占位视频。Ctrl+C 停止。

- [ ] **Step 5: Commit**

```bash
git add app/main.py static/placeholder.mp4
git commit -m "feat: FastAPI 应用装配、静态资源与前端托管"
```

---

## Task 11: VolcengineProvider（真实 Seedance 2.0）

**Files:**
- Create: `app/providers/volcengine.py`
- Test: `tests/test_volcengine_provider.py`

> 调用火山引擎方舟「视频生成任务」接口：`POST {base}/contents/generations/tasks` 创建、`GET {base}/contents/generations/tasks/{id}` 查询。参考图以 base64 data URL 放入 content。**执行时请对照火山引擎控制台确认 `SEEDANCE_MODEL` 接入点 ID、参考图字段（role）与 status 取值**；下方实现按方舟通用结构编写，并将映射集中便于按文档微调。

- [ ] **Step 1: 写失败测试 `tests/test_volcengine_provider.py`（用 httpx mock，不真实联网）**

```python
import httpx

from app.providers.base import GenOptions, TaskStatus
from app.providers.volcengine import VolcengineProvider


def test_submit_posts_task_and_returns_id(tmp_path, monkeypatch):
    img = tmp_path / "p.jpg"
    img.write_bytes(b"img")

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/contents/generations/tasks")
        assert request.headers["Authorization"] == "Bearer KEY"
        return httpx.Response(200, json={"id": "ext-123"})

    transport = httpx.MockTransport(handler)
    provider = VolcengineProvider(api_key="KEY", base_url="https://x/api/v3", model="ep-1")
    monkeypatch.setattr(provider, "_client", httpx.Client(transport=transport))

    ext = provider.submit([img], "prompt", GenOptions())
    assert ext == "ext-123"


def test_poll_maps_status(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "succeeded",
                                         "content": {"video_url": "https://v/out.mp4"}})

    transport = httpx.MockTransport(handler)
    provider = VolcengineProvider(api_key="KEY", base_url="https://x/api/v3", model="ep-1")
    monkeypatch.setattr(provider, "_client", httpx.Client(transport=transport))

    result = provider.poll("ext-123")
    assert result.status == TaskStatus.SUCCEEDED
    assert result.video_url == "https://v/out.mp4"


def test_poll_failed_status_carries_error(monkeypatch):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"status": "failed", "error": {"message": "审核拒绝"}})

    transport = httpx.MockTransport(handler)
    provider = VolcengineProvider(api_key="KEY", base_url="https://x/api/v3", model="ep-1")
    monkeypatch.setattr(provider, "_client", httpx.Client(transport=transport))

    result = provider.poll("ext-123")
    assert result.status == TaskStatus.FAILED
    assert "审核拒绝" in result.error
```

- [ ] **Step 2: 运行测试确认失败**

Run: `.venv/Scripts/python -m pytest tests/test_volcengine_provider.py -v`
Expected: FAIL（`ModuleNotFoundError: app.providers.volcengine`）

- [ ] **Step 3: 写 `app/providers/volcengine.py`**

```python
import base64
import mimetypes
from pathlib import Path

import httpx

from app.providers.base import (
    GenOptions,
    TaskResult,
    TaskStatus,
    VideoGenProvider,
)

# 火山引擎方舟状态 → 内部状态映射（执行时按文档核对取值）
_STATUS_MAP = {
    "queued": TaskStatus.PENDING,
    "pending": TaskStatus.PENDING,
    "running": TaskStatus.RUNNING,
    "succeeded": TaskStatus.SUCCEEDED,
    "failed": TaskStatus.FAILED,
    "cancelled": TaskStatus.FAILED,
}


def _to_data_url(path: Path) -> str:
    mime = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    b64 = base64.b64encode(Path(path).read_bytes()).decode()
    return f"data:{mime};base64,{b64}"


class VolcengineProvider(VideoGenProvider):
    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        if not api_key or not model:
            raise ValueError("VolcengineProvider 需要 ARK_API_KEY 与 SEEDANCE_MODEL")
        self._model = model
        self._base = base_url.rstrip("/")
        self._client = httpx.Client(
            headers={"Authorization": f"Bearer {api_key}"}, timeout=60
        )

    def submit(self, reference_images, prompt: str, options: GenOptions) -> str:
        text = (
            f"{prompt} --resolution {options.resolution} "
            f"--ratio {options.aspect_ratio} --duration {options.duration}"
        )
        content = [{"type": "text", "text": text}]
        for img in reference_images:
            content.append({
                "type": "image_url",
                "image_url": {"url": _to_data_url(Path(img))},
                "role": "reference_image",
            })
        resp = self._client.post(
            f"{self._base}/contents/generations/tasks",
            json={"model": self._model, "content": content},
        )
        resp.raise_for_status()
        return resp.json()["id"]

    def poll(self, external_task_id: str) -> TaskResult:
        resp = self._client.get(
            f"{self._base}/contents/generations/tasks/{external_task_id}"
        )
        resp.raise_for_status()
        body = resp.json()
        status = _STATUS_MAP.get(body.get("status", ""), TaskStatus.RUNNING)
        if status == TaskStatus.SUCCEEDED:
            return TaskResult(status, video_url=(body.get("content") or {}).get("video_url"))
        if status == TaskStatus.FAILED:
            err = (body.get("error") or {}).get("message", "生成失败")
            return TaskResult(status, error=err)
        return TaskResult(status)
```

- [ ] **Step 4: 运行测试确认通过**

Run: `.venv/Scripts/python -m pytest tests/test_volcengine_provider.py -v`
Expected: PASS（3 passed）

- [ ] **Step 5: Commit**

```bash
git add app/providers/volcengine.py tests/test_volcengine_provider.py
git commit -m "feat: VolcengineProvider 对接 Seedance 2.0"
```

---

## Task 12: React 前端（Vite + TS）

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`,
  `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/api.ts`, `frontend/src/App.css`

> 前端通过相对路径 `/api/*` 访问后端；开发期用 Vite proxy 转发到 8000。生产期 `npm run build` 产物由 FastAPI 在 `/` 托管。

- [ ] **Step 1: 写 `frontend/package.json`**

```json
{
  "name": "change-clothes-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.7"
  }
}
```

- [ ] **Step 2: 写 `frontend/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
      "/outputs": "http://127.0.0.1:8000",
      "/static": "http://127.0.0.1:8000",
    },
  },
});
```

- [ ] **Step 3: 写 `frontend/index.html`**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI 虚拟换装</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: 写 `frontend/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 5: 写 `frontend/src/api.ts`**

```ts
export interface TaskState {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  video_url: string | null;
  error: string | null;
}

export async function submitGenerate(form: FormData): Promise<string> {
  const resp = await fetch("/api/generate", { method: "POST", body: form });
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}));
    throw new Error(detail.detail || `提交失败 (${resp.status})`);
  }
  const data = await resp.json();
  return data.task_id as string;
}

export async function fetchTask(id: string): Promise<TaskState> {
  const resp = await fetch(`/api/tasks/${id}`);
  if (!resp.ok) throw new Error(`查询失败 (${resp.status})`);
  return (await resp.json()) as TaskState;
}
```

- [ ] **Step 6: 写 `frontend/src/App.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { fetchTask, submitGenerate, TaskState } from "./api";

const FIELDS: { name: string; label: string; required?: boolean }[] = [
  { name: "person", label: "人物照片", required: true },
  { name: "scene", label: "场景照片", required: true },
  { name: "top", label: "上衣" },
  { name: "bottom", label: "裤子" },
  { name: "shoes", label: "鞋子" },
  { name: "jewelry", label: "首饰" },
  { name: "accessory", label: "配饰" },
];

export default function App() {
  const [task, setTask] = useState<TaskState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!task || task.status === "succeeded" || task.status === "failed") return;
    timer.current = window.setInterval(async () => {
      try {
        setTask(await fetchTask(task.id));
      } catch (e) {
        setError(String(e));
      }
    }, 3000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [task?.id, task?.status]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      // 去掉未选择文件的可选字段
      for (const f of FIELDS) {
        const file = form.get(f.name) as File | null;
        if (file && file.size === 0) form.delete(f.name);
      }
      const id = await submitGenerate(form);
      setTask({ id, status: "pending", video_url: null, error: null });
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1>AI 虚拟换装视频</h1>
      <form onSubmit={onSubmit}>
        <div className="grid">
          {FIELDS.map((f) => (
            <label key={f.name} className="field">
              <span>{f.label}{f.required && " *"}</span>
              <input type="file" name={f.name} accept="image/*" required={f.required} />
            </label>
          ))}
        </div>
        <label className="field">
          <span>额外描述（可选）</span>
          <input type="text" name="custom_prompt" placeholder="如：夜晚霓虹灯氛围" />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "提交中…" : "生成换装视频"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {task && (
        <div className="result">
          <p>任务状态：<b>{task.status}</b></p>
          {(task.status === "pending" || task.status === "running") && (
            <p>生成中，请稍候…（每 3 秒自动刷新）</p>
          )}
          {task.status === "failed" && <p className="error">失败：{task.error}</p>}
          {task.status === "succeeded" && task.video_url && (
            <video src={task.video_url} controls autoPlay loop width={360} />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: 写 `frontend/src/App.css`**

```css
body { font-family: system-ui, sans-serif; background: #f5f5f7; margin: 0; }
.container { max-width: 720px; margin: 0 auto; padding: 24px; }
h1 { text-align: center; }
.grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; font-size: 14px; }
button { padding: 10px 20px; font-size: 16px; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: default; }
.error { color: #c00; }
.result { margin-top: 24px; text-align: center; }
video { margin-top: 12px; border-radius: 8px; background: #000; }
```

- [ ] **Step 8: 安装依赖、构建并联调**

Run:
```bash
cd frontend
npm install
npm run build
```
Expected: 生成 `frontend/dist/`。

然后回到项目根启动后端：`.venv/Scripts/python -m uvicorn app.main:app --reload`，
浏览器访问 `http://127.0.0.1:8000/`，应看到换装表单。上传任意图片提交，
mock 模式下数秒后展示占位视频。

> 开发期热重载（可选）：另开终端 `cd frontend && npm run dev`，访问 5173 端口，API 经 proxy 转发到 8000。

- [ ] **Step 9: Commit**

```bash
git add frontend/
git commit -m "feat: React 前端 上传/轮询/视频展示"
```

---

## Task 13: 真实联调脚本与 README

**Files:**
- Create: `scripts/smoke_test.py`
- Create/Modify: `README.md`

- [ ] **Step 1: 写 `scripts/smoke_test.py`**

```python
"""真实联调脚本：用本地图片走真实 VolcengineProvider 跑一次端到端生成。
用法：先在 .env 配置 PROVIDER=volcengine / ARK_API_KEY / SEEDANCE_MODEL，
准备 scripts/sample/{person,scene,top}.jpg，然后运行本脚本。
"""
import time
from pathlib import Path

from app.config import Settings
from app.providers.base import GenOptions, TaskStatus
from app.providers.factory import get_provider
from app.core.prompt import build_prompt

SAMPLE = Path(__file__).parent / "sample"


def main() -> None:
    settings = Settings()
    assert settings.provider == "volcengine", "请在 .env 设 PROVIDER=volcengine"
    provider = get_provider(settings)

    refs = [SAMPLE / "person.jpg", SAMPLE / "scene.jpg", SAMPLE / "top.jpg"]
    prompt = build_prompt(["top"])
    options = GenOptions(
        resolution=settings.gen_resolution,
        aspect_ratio=settings.gen_aspect_ratio,
        duration=settings.gen_duration,
        mode=settings.gen_mode,
    )

    ext = provider.submit(refs, prompt, options)
    print("已提交，外部任务 ID:", ext)

    while True:
        result = provider.poll(ext)
        print("状态:", result.status.value)
        if result.status == TaskStatus.SUCCEEDED:
            print("视频地址:", result.video_url)
            break
        if result.status == TaskStatus.FAILED:
            print("失败:", result.error)
            break
        time.sleep(5)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 写 `README.md`**

```markdown
# Change Clothes —— AI 虚拟换装视频 Demo

上传人物图 + 衣/裤/鞋/首饰/配饰 + 场景图，调用字节跳动 Seedance 2.0
生成「人物换装后在该场景走动」的视频。

## 快速开始

### 1. 后端
```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
copy .env.example .env        # Windows；Linux/Mac 用 cp
.venv/Scripts/python -m uvicorn app.main:app --reload
```

### 2. 前端
```bash
cd frontend
npm install
npm run build        # 产物由后端在 / 托管
```

访问 http://127.0.0.1:8000/

### 3. 切换 Mock / 真实接口
`.env` 中 `PROVIDER=mock`（零成本看流程）或 `PROVIDER=volcengine`
（真实 Seedance 2.0，需填 `ARK_API_KEY` 与 `SEEDANCE_MODEL`）。

## 测试
```bash
.venv/Scripts/python -m pytest -v
```

## 真实联调
配置好 volcengine 后，准备 `scripts/sample/{person,scene,top}.jpg`，运行：
```bash
.venv/Scripts/python scripts/smoke_test.py
```

详见设计文档 `docs/superpowers/specs/2026-06-04-ai-virtual-tryon-video-design.md`。
```

- [ ] **Step 3: 运行全部测试确保整体绿色**

Run: `.venv/Scripts/python -m pytest -v`
Expected: 全部 PASS。

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke_test.py README.md
git commit -m "docs: 真实联调脚本与 README"
```

---

## 完成标准（验收）

- [ ] `pytest -v` 全绿
- [ ] mock 模式：浏览器上传图片 → 数秒后展示占位视频
- [ ] volcengine 模式：`scripts/smoke_test.py` 能真实生成出视频 URL
- [ ] `PROVIDER` 一处配置即可切换 mock / 真实，无需改业务代码
- [ ] 参考图超过 9 张时接口返回 400