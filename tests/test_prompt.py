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


def test_image_prompt_keeps_identity_and_lists_items():
    from app.core.prompt import build_image_prompt
    p = build_image_prompt(["top", "accessory"])
    assert "上衣" in p
    assert "配饰" in p
    assert "保持" in p and "面部" in p  # 强调身份不变


def test_image_prompt_appends_custom():
    from app.core.prompt import build_image_prompt
    p = build_image_prompt(["top"], custom="阳光午后")
    assert "阳光午后" in p


def test_video_prompt_fixed_text_and_custom():
    from app.core.prompt import build_video_prompt
    p = build_video_prompt()
    assert "转身" in p
    assert "向前走动" in p
    assert "9:16" in p
    p2 = build_video_prompt(custom="夜晚霓虹")
    assert p2.endswith("夜晚霓虹")