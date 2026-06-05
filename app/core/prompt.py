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
        "人物在场景中先完成一个完整的转身动作，随后自然地向前走动，"
        "整体动作舒缓流畅、节奏从容不急促。"
        "人物与场景的光影、透视和色调自然融合，竖屏 9:16 构图，电影感运镜，"
        "光线自然真实，画面稳定流畅。"
    )
    if custom:
        prompt += f" {custom.strip()}"
    return prompt


_CN_NUM = {1: "一", 2: "两", 3: "三", 4: "四", 5: "五"}

_IMG_IDENTITY = "严格保持图1中人物的面部五官、发型、肤色、体型胖瘦和性别与原图完全一致"
_IMG_TAIL = "保持与图1相同的姿势、构图和取景。写实人像，服饰自然贴合身体，光线真实，高清。"


def build_image_prompt(
    present_fields: list[str],
    with_scene: bool = False,
    custom: str | None = None,
) -> str:
    """换装定妆照提示词（位置指代）。

    参考图发送顺序固定为 [人物, *服饰, (可选)场景]，用「图1/图2…」明确指代。
    - 图1 = 人物；图2.. = 各服饰；with_scene 时最后一张 = 场景
    - with_scene=True：让人物站进该场景，产出可直接当视频首帧的全身定妆照
    - 只选 1 件：强调除该件外其余穿着保持不变；≥2 件：强调仅更换这几件
    """
    labels = [ITEM_LABELS[f] for f in present_fields if f in ITEM_LABELS]
    scene_idx = len(labels) + 2  # 场景图号（图1人物 + len 件服饰之后）

    parts = ["图1为人物"]
    parts += [f"图{i + 2}为{lab}" for i, lab in enumerate(labels)]
    if with_scene:
        parts.append(f"图{scene_idx}为场景")
    mapping = "，".join(parts) + "。"

    if labels:
        wear = "、".join(f"图{i + 2}的{lab}" for i, lab in enumerate(labels))
        action = f"让图1中的人物换上{wear}"
    else:
        action = "保持图1中人物的服饰不变"
    action += f"，并自然地站在图{scene_idx}的场景中。" if with_scene else "。"

    if len(labels) == 1:
        middle = f"{_IMG_IDENTITY}。除{labels[0]}外，图1中人物原有的其他穿着全部保持不变。"
    elif len(labels) >= 2:
        n = _CN_NUM.get(len(labels), str(len(labels)))
        middle = f"{_IMG_IDENTITY}，仅更换上述{n}件服饰。"
    else:
        middle = f"{_IMG_IDENTITY}。"

    if with_scene:
        tail = "全身站立正面，写实人像，人物与场景的光影、透视和色调自然融合，光线真实，高清。"
    else:
        tail = _IMG_TAIL

    prompt = mapping + action + middle + tail
    if custom:
        prompt += f" {custom.strip()}"
    return prompt