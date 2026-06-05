from pathlib import Path

from fastapi import FastAPI
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