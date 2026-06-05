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