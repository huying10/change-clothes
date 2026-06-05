# Change Clothes —— AI 虚拟换装视频 Demo

上传人物图 + 衣/裤/鞋/首饰/配饰 + 场景图，调用字节跳动 Seedance 2.0
生成「人物换装后在该场景走动」的视频。

## 快速开始

### 1. 后端
    python -m venv .venv
    .venv/Scripts/python -m pip install -r requirements.txt
    copy .env.example .env
    .venv/Scripts/python -m uvicorn app.main:app --reload

### 2. 前端
    cd frontend
    npm install
    npm run build

访问 http://127.0.0.1:8000/

### 3. 切换 Mock / 真实接口
`.env` 中 `PROVIDER=mock`（零成本看流程）或 `PROVIDER=volcengine`
（真实 Seedance 2.0，需填 `ARK_API_KEY` 与 `SEEDANCE_MODEL`）。

## 测试
    .venv/Scripts/python -m pytest -v

## 真实联调
配置好 volcengine 后，准备 `scripts/sample/{person,scene,top}.jpg`，运行：

    .venv/Scripts/python scripts/smoke_test.py

详见设计文档 `docs/superpowers/specs/2026-06-04-ai-virtual-tryon-video-design.md`
与实现计划 `docs/superpowers/plans/2026-06-05-ai-virtual-tryon-video.md`。