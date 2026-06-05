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


def build_video_prompt(custom: str | None = None) -> str:
    """两段式视频提示词：人物已在换装图中穿好服饰，仅需保持原貌融入场景并走动。"""
    prompt = (
        "参考图中的人物保持原貌出现在视频中，将该人物自然地融入指定场景里。"
        "严格保持人物的面部五官、发型、体型和服饰与参考图完全一致，"
        "不要改变人物的任何外观和已有穿着。"
        "人物在场景中先完成一个完整的转身动作，随后自然地向前走动。"
        "人物与场景的光影、透视和色调自然融合，竖屏 9:16 构图，电影感运镜，"
        "光线自然真实，画面稳定流畅。"
    )
    if custom:
        prompt += f" {custom.strip()}"
    return prompt


_CN_NUM = {1: "一", 2: "两", 3: "三", 4: "四", 5: "五"}

# 各类对应的「未选中时」保留措辞用的统称
_IDENTITY = "严格保持人物的面部五官、发型、肤色、体型胖瘦和性别与参考图完全一致"
_TAIL = "保持与参考图相同的姿势、构图和取景。写实人像，服饰自然贴合身体，光线真实，高清。"


def build_image_prompt(present_fields: list[str], custom: str | None = None) -> str:
    """换装静图提示词：让人物换上所选服饰，严格锁定人物身份、姿势与取景。

    - 只选 1 件：强调除该件外其余穿着全部保持不变
    - 选 ≥2 件：强调仅更换这几件服饰
    """
    items = [ITEM_LABELS[f] for f in present_fields if f in ITEM_LABELS]

    if not items:
        prompt = f"保持参考图中的人物外貌与服饰不变。{_IDENTITY}。{_TAIL}"
    elif len(items) == 1:
        prompt = (
            f"让参考图中的人物换上所提供的{items[0]}。{_IDENTITY}。"
            f"除{items[0]}外，参考图中原有的其他穿着全部保持不变。{_TAIL}"
        )
    else:
        joined = "、".join(items)
        n = _CN_NUM.get(len(items), str(len(items)))
        prompt = (
            f"让参考图中的人物换上所提供的{joined}。{_IDENTITY}，"
            f"仅更换上述{n}件服饰。{_TAIL}"
        )

    if custom:
        prompt += f" {custom.strip()}"
    return prompt