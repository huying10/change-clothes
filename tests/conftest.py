import os

# 测试一律使用 mock provider，且零延迟。
# 环境变量优先级高于 .env，避免测试读到 .env 里的真实配置而发起真实请求。
os.environ["PROVIDER"] = "mock"
os.environ["MOCK_DELAY_SECONDS"] = "0"
os.environ["ENABLE_VIDEO"] = "true"
os.environ["SEEDREAM_MODELS"] = "{}"