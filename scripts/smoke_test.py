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