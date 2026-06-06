# AI 虚拟换装视频应用 —— 预研设计文档

- **日期**：2026-06-04
- **作者**：huying10
- **状态**：已实现，真实接口端到端跑通（2026-06-06）
- **定位**：预研 Demo（验证 Seedance 2.0 + Seedream 可行性），架构预留产品化扩展空间
- **核心架构**：两段式生成 —— Seedream 把「人物 + 服饰配饰 + 场景」合成 **1 张定妆照**，Seedance 用这**单张图当首帧(图生视频 i2v)**出视频
- **状态更新**：2026-06-06 已切真实接口（火山方舟）首次端到端跑通（换装定妆照 + 视频均成功）

---

## 1. 背景与目标

预研字节跳动 **Seedance 2.0** 视频生成大模型。目标是基于它做一个
**AI 虚拟换装 Web 应用**：用户上传人物照片，按分类上传想换的上衣、下裤、鞋子、
首饰、配饰，以及一张场景照片（如步行街），最终生成「人物换装后在该场景中走动」
的**换装图片与视频**。

本阶段为 **Demo / POC**，核心目的是验证 Seedance 2.0（视频）+ Seedream（图片换装）
的效果是否可行，但架构上为将来转正式产品预留扩展空间。

### 两段式生成（核心设计）
1. **Seedream**（豆包·图像创作模型）把「人物 + 所选服饰配饰 + 场景」用**多图融合**合成
   **1 张定妆照**：人物穿好整套服饰、全身站立在该场景中，严格保持面部/发型/肤色/体型/
   性别不变。
2. **Seedance 2.0** 用这**单张定妆照当首帧**（图生视频 i2v）生成视频：人物先转身、再走动。

> 关键收益：
> - **Seedance 只收 1 张图**（首帧），彻底规避多图参考的数量/一致性限制，且首帧 i2v 对
>   人物 identity 保持最强（定妆照即起点）。
> - 换装 + 场景融合交给专业图片模型 Seedream，运动交给视频模型 Seedance，各司其职。
> - 与火山官方 i2v 示例（单图、无 role）逐字对齐，接入风险最低。

### 成功标准
- 跑通完整闭环：上传图片 → Seedream 合成换装图 → Seedance 生成视频 → 展示图片与视频
- 「调用模型」封装为可切换模块（图片/视频各一套），火山引擎为主、fal 为备
- 人物面部与身材在换装后保持一致（提示词锁定 + 模型保真，预研重点验证）
- 错误处理清晰（图片失败回退原始人物图），前后端同一项目，一次启动即可演示

---

## 2. Seedance 2.0 预研结论

字节跳动（豆包 / Seed 团队）的**电影级多模态视频生成大模型**，2026 年 4 月
通过**火山引擎**正式开放 API。在 Artificial Analysis Video Arena 排名第一
（Elo 1269），超过 Google Veo 3、OpenAI Sora 2、Runway Gen-4.5。

### 对换装场景的关键能力

| 能力 | 详情 | 对换装的意义 |
|------|------|------------|
| 图生视频 (i2v) | 单张图当首帧驱动生成 | **最终采用**：定妆照当首帧，identity 最强、对齐官方示例 |
| 多图参考 (Reference-to-Video) | 单次最多参考 9 张图 | 备选；本项目改为"多图融合交给 Seedream、视频只收 1 张首帧"而未直接使用 |
| 场景控制 | 文本 prompt 描述运镜/节奏 | 场景已合进定妆照，视频侧用文本控制转身/走动/运镜 |
| 时长 | 单次最长 **15 秒**，支持多镜头 | 一段短视频够用 |
| 分辨率 | 480p / 720p / 1080p（2026-04-21 起支持 1080P） | 可配置 |
| 宽高比 | 9:16、16:9、1:1、4:3、3:4、21:9 | 竖屏 9:16 适合换装短视频 |
| 原生音频 | 自带配音/音效/口型同步，中英文 | 可选加分项 |

### 接入渠道
- **火山引擎方舟（豆包原厂）** —— 国内首选，合规稳定、低延迟、中文支持。**本项目选此。**
- fal.ai / Replicate / BytePlus —— 海外聚合平台，SDK 上手快，但国内访问需代理、
  按美元计费、数据出境有合规风险。**作为备用 provider 预留。**

### 定价（参考）
约 **$0.081/秒（Fast 模式）** ~ **$0.1/秒（标准）**。10 秒视频约 ¥6–7 成本量级。

---

## 2.5 Seedream 预研结论（图片换装）

**Seedream**（豆包·图像创作模型，4.0/5.0）与 Seedance **同在火山方舟、共用同一 ARK_API_KEY**。
官方有「Seedream 助力 Seedance 生视频最佳实践」，即「先图后视频」组合。

| 能力 | 详情 | 对换装的意义 |
|------|------|------------|
| 多参考图图生图 | 支持 **1–14 张参考图**，多图融合 2–5 张 | 人物 + 多件服饰一次合成 |
| 虚拟换装/试穿 | 官方明确支持服装试穿、人物换装 | 核心：把所选服饰穿到人物身上 |
| **同步返回** | `POST {base}/images/generations`，响应 `data[0].url` 直接给图 | 比视频快，正好做"先出图"那一段 |
| 字段 | `model`/`prompt`/`image`(参考图数组)/`size`/`response_format`/`watermark` | —— |

来源：[Seedream 4.0 助力 Seedance 最佳实践](https://www.volcengine.com/docs/82379/1951250)、
[Seedream API 参考](https://www.volcengine.com/docs/82379/1541523)

### 关键约束与风险（预研要点）
1. **~~9 张参考图上限~~（已由两段式架构解决）**：原方案把人物+5 单品+场景共 7 张直接喂
   Seedance，逼近上限且多图一致性差。**现方案 Seedance 只收 1 张（定妆照首帧）**——人物、
   服饰、场景全部由 Seedream 多图融合进这张定妆照，彻底规避该限制。多图融合上限由
   Seedream（≤14 张参考图）承担，余量充足。
2. **人物身份保持**：换装后脸/身材不能变。① Seedream 提示词用**位置指代 + 身份锁定**
   ("图1为人物…严格保持面部五官/发型/肤色/体型胖瘦/性别一致，仅换服饰")；② Seedance 走
   **首帧 i2v**（定妆照即视频起点，identity 最强）。**注意：转身动作最考验脸部保持**，
   实测若崩脸再调。2026-06-06 首次实测：换装图与视频均成功，脸/身材保持良好。
3. **异步 vs 同步**：图片同步、视频异步（轮询）。架构需同时支持两种。
4. **内容审核**：上传图与生成结果可能被审核拒绝，需捕获并友好提示。
5. **效果不确定性**：用户自上传单品图质量参差，是预研要重点验证的点。

来源：[Seedance 2.0 官方](https://seed.bytedance.com/en/seedance2_0)、
[fal.ai](https://fal.ai/seedance-2.0)、
[火山引擎开放](https://www.aihub.cn/news/seedance-2-0-api/)、
[IT之家 1080P](https://www.ithome.com/0/941/572.htm)

---

## 3. 技术栈

- **后端**：Python 3.11 + FastAPI + Uvicorn
- **前端**：React + Vite + TypeScript（轻量，构建产物由 FastAPI 托管）
- **前后端**：**同一项目（不分离仓库）**，FastAPI 同时提供 API 与托管前端静态页
- **异步任务**：Demo 用 FastAPI BackgroundTasks + 内存任务表；预留切 Celery/Redis
- **存储**：本地文件系统（`uploads/`、`outputs/`）；预留切换火山 TOS 对象存储
- **AI 调用**：火山引擎方舟 REST API —— Seedream（`/images/generations`，同步出定妆照）
  + Seedance 2.0（`/contents/generations/tasks`，异步**图生视频 i2v**，单图首帧、无 role）。
  本地图以 **base64 data URL** 传入 `image`（实测火山接受，无需先传 TOS）
- **前端**：antd 组件库；步进器向导（人物→服饰搭配→场景→生成），每类素材库可多上传+翻页选择；
  Canvas 即时拼"搭配预览卡"做缓冲；结果区「图片/视频」切换

---

## 4. 整体架构

```
┌─────────────────┐     HTTP       ┌──────────────────────────────────┐
│  前端 (React)    │ ─POST /generate▶│  后端 (FastAPI) 编排层             │
│ 步进器向导上传   │ ◀{task_id,     │ ① Seedream 适配层(图片/同步)       │ ◀ 可切换
│ Canvas缓冲卡     │   image_url}   │    人物+服饰+场景 ─多图融合→ 定妆照  │   (mock/火山)
│ 图片/视频切换    │                │              │ (这1张图)            │
│ 轮询视频状态     │ ─GET /tasks/{id}▶│              ▼                    │
└─────────────────┘ ◀video_url     │ ② Seedance 适配层(视频/异步)       │ ◀ 可切换
                                   │    定妆照当首帧(i2v) → 视频任务      │
                                   │ ┌─────────────────────────────┐  │
                                   │ │ 存储层(本地) + 内存任务表      │  │
                                   │ └─────────────────────────────┘  │
                                   └───────────────┬──────────────────┘
                                        REST API   │
                          ┌───────────────────────┴───────────────┐
                          ▼                                        ▼
                ┌──────────────────┐                   ┌─────────────────────┐
                │ 火山方舟 Seedream │                   │ 火山方舟 Seedance 2.0 │
                │ /images/generations(同步)             │ /contents/.../tasks(异步, i2v)
                └──────────────────┘                   └─────────────────────┘
```

---

## 5. 核心流程（两段式编排）

```
1. POST /api/generate
   前端上传 人物 + 所选服饰(上衣/下裤/鞋子/首饰/配饰) + 场景 + 可选提示词
   后端编排：
     ① Seedream 合成定妆照：generate([人物, *服饰, 场景], 换装提示词) → 定妆照(同步)
        提示词用位置指代 + 身份锁定 + "全身站立在图N的场景中"
        失败则回退用原始人物图当首帧
     ② Seedance 图生视频：submit([定妆照], 视频提示词) → 视频任务(异步)
        单图首帧 i2v、无 role；文本含 --duration N --camerafixed false --watermark false
   → 返回 {task_id, image_url}   （image_url 为定妆照，前端立即可看）

2. GET /api/tasks/{task_id}
   前端每 3 秒轮询 → 后端查 Seedance 状态，返回 pending/running/succeeded/failed

3. 视频完成 → 下载存 outputs/，返回 video_url → 前端「视频」视图播放
```

### 输入到定妆照的映射（关键：Seedance 只收 1 张首帧）
```
用户上传（每类可多张，选 1 张）：
  人物(图1) ┐
  上衣(图2) │
  下裤(图3) ├─① Seedream 多图融合 ──▶ 定妆照 ──② Seedance i2v
  鞋子(图4) │   "图1人物换上图2上衣…       (人物已换装       单图首帧
  首饰(…)   │    并站在图N的场景中"         且站在场景中)        ↓
  配饰(…)   │                                              人物转身+走动
  场景(图N) ┘                                                的视频(约8s)
                          ↓
            输出：定妆照(静图) + 换装走动视频
```

---

## 6. 项目结构（单项目，前后端同仓）

```
change-clothes/
├── app/                      # 后端主应用
│   ├── main.py               # FastAPI 入口，同时托管前端静态页
│   ├── api/
│   │   ├── generate.py       # POST /api/generate 两段式编排(图+视频)
│   │   ├── generate_image.py # POST /api/generate-image 仅出换装图(独立可选)
│   │   └── tasks.py          # GET /api/tasks/{id} 轮询视频状态
│   ├── providers/            # 模型适配层(可切换)
│   │   ├── base.py           # VideoGenProvider + ImageGenProvider 抽象
│   │   ├── mock.py           # MockProvider + MockImageProvider(零成本)
│   │   ├── volcengine.py     # Seedance 2.0 视频实现
│   │   ├── volcengine_image.py # Seedream 图片换装实现
│   │   └── factory.py        # get_provider / get_image_provider
│   ├── core/
│   │   ├── task_manager.py   # 视频任务表(内存版,预留Celery)
│   │   ├── storage.py        # 存储抽象(本地,预留TOS;存视频与图片)
│   │   └── prompt.py         # build_prompt(视频) + build_image_prompt(换装)
│   ├── deps.py               # 依赖装配(settings/storage/两个provider)
│   └── config.py             # 配置(ARK_API_KEY/SEEDANCE_MODEL/SEEDREAM_MODEL)
├── frontend/                 # React + Vite + antd
│   └── src/                  # 步进器向导 + collage.ts(Canvas缓冲卡) + 图片/视频切换
├── uploads/                  # 用户上传图(gitignore)
├── outputs/                  # 生成的换装图(.jpg)与视频(.mp4)(gitignore)
├── tests/                    # 测试
├── scripts/
│   └── smoke_test.py         # 真实联调脚本(手动跑)
├── .env.example              # 配置模板(不含真实Key)
├── requirements.txt
└── README.md
```

---

## 7. 关键设计：双 Provider 抽象

图片与视频各一套可切换接口。`mock` 实现零成本跑流程，`volcengine` 实现连真实模型。

```python
class VideoGenProvider(ABC):          # Seedance 2.0 视频，异步
    @abstractmethod
    def submit(self, reference_images: list[Path], prompt: str,
               options: GenOptions) -> str: ...   # 返回外部任务 ID
    @abstractmethod
    def poll(self, external_task_id: str) -> TaskResult: ...  # 查状态/结果

class ImageGenProvider(ABC):          # Seedream 图片换装，同步
    @abstractmethod
    def generate(self, reference_images: list[Path], prompt: str,
                 options: GenOptions) -> bytes: ...  # 同步返回图片字节
```

收益：
- `PROVIDER=mock|volcengine` 一处配置同时切换图片与视频两套实现
- 火山开通慢/限流时，图片或视频可分别临时切 mock 或备用 provider
- 将来换模型、加备选不动业务代码；测试全走 mock，不烧钱

---

## 8. 错误处理

- **上传校验**：人物、场景为必传（缺失返回 422）；服饰各类可选
- **图片(Seedream)失败回退**：换装图生成失败时回退用原始人物图提交 Seedance，
  保证视频仍能产出；前端图片视图回退展示 Canvas 搭配卡
- **Seedance 调用失败**：超时、限流(429)、内容审核拒绝 → 捕获，任务标记 `failed`
  并记录原因，前端展示友好提示
- **任务超时**：生成超过设定时长视为超时，避免前端无限轮询
- **日志**：所有外部 API 调用记录请求/响应，便于预研排查效果

---

## 9. 测试策略

- **Provider 层**：用 `MockProvider` 测试，不真实调 API
- **任务流程**：测试 提交→轮询→完成/失败 的状态流转
- **提示词组装**：测试不同单品组合生成的 prompt 正确
- **真实联调**：`scripts/smoke_test.py` 手动跑一次真实生成，验证端到端效果

---

## 10. 产品化扩展点

| 当前 (Demo) | 预留接口 → 将来 (产品) |
|------------|----------------------|
| 内存任务表 | `task_manager` 抽象 → Celery + Redis |
| 本地文件存储 | `storage` 抽象 → 火山 TOS 对象存储 |
| 火山引擎单一 provider | `VideoGenProvider` 接口 → 多模型可选 |
| 无用户系统 | API 预留 user_id 字段 → 接入登录 |
| 用户上传单品 | 表单结构预留 → 接入预设单品库 |
| 上传场景图 | 预留 → 接入预设场景库 + 提示词模板 |

---

## 11. 成本评估

### 计费方式
单次生成 = 1 次 Seedream 图片 + 1 次 Seedance 视频。开发与本地运行本身不产生费用。

| 环节 | 计费 | 单次成本 |
|------|------|---------|
| Seedream 换装图 | 按张/分辨率（图片单价低） | 约 ¥0.2–0.5/张 |
| Seedance 视频 Fast | 约 $0.081/秒 | 10 秒约 ¥6 |
| Seedance 视频 标准 | 约 $0.1/秒 | 10 秒约 ¥7 |

> 图片成本远低于视频，整体仍由视频主导。1080P/标准更贵，480p+Fast 最省。

### Demo 阶段总成本估算
联调按 50 次 × （¥6 视频 + ¥0.3 图片）≈ **¥315，约 ¥300 量级**即可完成验证。
实际取决于真实生成次数。

### 不产生费用的部分
- 写代码、本地运行前后端、调试逻辑
- 使用 `MockProvider`（假数据）跑通整个流程
- 本地存储图片 / 视频

### 省钱开发策略（已落入设计）
1. **双模式可切换**：`PROVIDER=mock|volcengine` 同时切换图片与视频两套实现。
   - **Mock 模式**：换装图返回占位 `static/placeholder.jpg`、视频返回占位 mp4，
     零成本跑通"上传→两段编排→展示"全流程，先看交互。
   - **真实模式**：连 Seedream + Seedance 2.0，验证真实换装效果。
2. 真实验证优先用 **Fast 模式 + 480p**，效果满意后再偶尔跑标准 / 1080P 看高清。
3. 自动化测试一律走 Mock，不烧钱。

### 前置条件
火山引擎方舟账号需**实名 + 预充值**后方可调用（已开通）。`.env` 配置
`PROVIDER=volcengine` + `ARK_API_KEY` + `SEEDANCE_MODEL`（视频接入点）+
`SEEDREAM_MODEL`（图片换装接入点）即可连真实接口验证。

---

## 12. 非目标（YAGNI，本阶段不做）

- 用户注册 / 登录 / 权限系统
- 预设单品库、预设场景库
- 支付 / 商业化
- 视频后期编辑、分发
- 多并发性能优化、分布式部署
