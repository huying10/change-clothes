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


def build_image_prompt(present_fields: list[str], custom: str | None = None) -> str:
    """换装静图提示词：让人物穿上所选服饰，严格保持人物身份不变。"""
    items = [ITEM_LABELS[f] for f in present_fields if f in ITEM_LABELS]
    wearing = "、".join(items) if items else "参考图中的服饰"
    prompt = (
        f"让参考图中的人物穿上所提供的{wearing}，"
        "严格保持人物的面部五官、发型、肤色和体型与参考图完全一致，仅更换服饰；"
        "全身写实人像，服饰自然贴合身体，光线真实，高清。"
    )
    if custom:
        prompt += f" {custom.strip()}"
    return prompt