import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  ConfigProvider,
  Input,
  Pagination,
  Result,
  Segmented,
  Space,
  Spin,
  Steps,
  Tabs,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import {
  CheckCircleFilled,
  CloseOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import zhCN from "antd/locale/zh_CN";
import { fetchTask, submitGenerate, type TaskState } from "./api";
import { buildCollage } from "./collage";

const { Title, Paragraph, Text } = Typography;

interface SubCat {
  key: string; // 同时作为后端字段名
  label: string;
  icon: string;
  required?: boolean;
}

const PERSON: SubCat = { key: "person", label: "人物", icon: "🧍", required: true };
const SCENE: SubCat = { key: "scene", label: "场景", icon: "🏙️", required: true };
const OUTFIT: SubCat[] = [
  { key: "top", label: "上衣", icon: "👕" },
  { key: "bottom", label: "下裤", icon: "👖" },
  { key: "shoes", label: "鞋子", icon: "👟" },
  { key: "jewelry", label: "首饰", icon: "💍" },
  { key: "accessory", label: "配饰", icon: "👜" },
];
const ALL_CATS: SubCat[] = [PERSON, ...OUTFIT, SCENE];

const GENERATE_STEP = 3; // 0人物 1服饰 2场景 3生成

interface Asset {
  id: string;
  url: string;
  file: File;
}

const PAGE_SIZE = 4;

const STATUS_META: Record<TaskState["status"], { color: string; text: string }> = {
  pending: { color: "default", text: "排队中" },
  running: { color: "processing", text: "生成中" },
  succeeded: { color: "success", text: "已完成" },
  failed: { color: "error", text: "失败" },
};

let assetSeq = 0;

export default function App() {
  const [current, setCurrent] = useState(0);
  const [library, setLibrary] = useState<Record<string, Asset[]>>({});
  const [selection, setSelection] = useState<Record<string, string | null>>({});
  const [page, setPage] = useState<Record<string, number>>({});
  const [customPrompt, setCustomPrompt] = useState("");
  const [task, setTask] = useState<TaskState | null>(null);
  const [collageUrl, setCollageUrl] = useState<string | null>(null);
  const [realImageUrl, setRealImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [resultView, setResultView] = useState<"collage" | "image" | "video">("collage");
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!task || task.status === "succeeded" || task.status === "failed") return;
    timer.current = window.setInterval(async () => {
      try {
        setTask(await fetchTask(task.id));
      } catch (e) {
        message.error(String(e));
      }
    }, 3000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [task?.id, task?.status]);

  function addAsset(catKey: string, file: File) {
    const asset: Asset = { id: `a${assetSeq++}`, url: URL.createObjectURL(file), file };
    setLibrary((prev) => {
      const list = [...(prev[catKey] || []), asset];
      setPage((p) => ({ ...p, [catKey]: Math.ceil(list.length / PAGE_SIZE) }));
      return { ...prev, [catKey]: list };
    });
    setSelection((prev) => (prev[catKey] ? prev : { ...prev, [catKey]: asset.id }));
  }

  function removeAsset(catKey: string, assetId: string) {
    setLibrary((prev) => {
      const list = prev[catKey] || [];
      const target = list.find((a) => a.id === assetId);
      if (target) URL.revokeObjectURL(target.url);
      return { ...prev, [catKey]: list.filter((a) => a.id !== assetId) };
    });
    setSelection((prev) => (prev[catKey] === assetId ? { ...prev, [catKey]: null } : prev));
  }

  function selectedAsset(catKey: string): Asset | undefined {
    const id = selection[catKey];
    if (!id) return undefined;
    return (library[catKey] || []).find((a) => a.id === id);
  }

  function goNext() {
    if (current === 0 && !selectedAsset("person")) {
      message.warning("请先上传并选择「人物」");
      return;
    }
    if (current === 2 && !selectedAsset("scene")) {
      message.warning("请先上传并选择「场景」");
      return;
    }
    setCurrent((s) => Math.min(s + 1, GENERATE_STEP));
  }

  async function onSubmit() {
    if (!selectedAsset("person") || !selectedAsset("scene")) {
      message.warning("请先选择「人物」和「场景」");
      return;
    }
    setSubmitting(true);
    setRealImageUrl(null);
    setResultView("collage");
    try {
      // ① Canvas 秒出搭配预览卡（缓冲）
      try {
        const items = OUTFIT.filter((c) => selectedAsset(c.key)).map((c) => ({
          url: selectedAsset(c.key)!.url,
          label: c.label,
        }));
        const collage = await buildCollage({
          person: selectedAsset("person")?.url,
          scene: selectedAsset("scene")?.url,
          items,
        });
        setCollageUrl(collage);
      } catch {
        setCollageUrl(null);
      }

      const form = new FormData();
      for (const cat of ALL_CATS) {
        const asset = selectedAsset(cat.key);
        if (asset) form.append(cat.key, asset.file);
      }
      if (customPrompt.trim()) form.append("custom_prompt", customPrompt.trim());

      // 后端编排：先 Seedream 合成换装图，再用 [换装图, 场景] 提交 Seedance 视频
      setImageLoading(true);
      const { taskId, imageUrl, imageError } = await submitGenerate(form);
      if (imageUrl) {
        setRealImageUrl(imageUrl);
        setResultView("image"); // 换装图好了自动切到它（视频仍由用户手动切）
      }
      setImageLoading(false);
      setTask({ id: taskId, status: "pending", video_url: null, error: null });
      if (imageError) {
        message.warning("换装图生成失败，本次视频用了原图（未换装）。可重试", 6);
      } else {
        message.success("换装图已生成，视频生成中…");
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const videoReady = task?.status === "succeeded" && !!task.video_url;

  // 渲染某一类的素材库（上传 + 翻页画廊）
  function renderGallery(cat: SubCat) {
    const list = library[cat.key] || [];
    const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const cur = Math.min(page[cat.key] || 1, pageCount);
    const start = (cur - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);
    return (
      <>
        <div className="gallery-row">
          <Upload
            multiple
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              addAsset(cat.key, file);
              return false;
            }}
          >
            <div className="add-tile">
              <PlusOutlined />
              <span>上传</span>
            </div>
          </Upload>

          {pageItems.map((asset) => {
            const active = selection[cat.key] === asset.id;
            return (
              <div
                key={asset.id}
                className={`asset-card ${active ? "active" : ""}`}
                onClick={() => setSelection((prev) => ({ ...prev, [cat.key]: asset.id }))}
              >
                <img src={asset.url} alt={cat.label} />
                {active && (
                  <span className="asset-check">
                    <CheckCircleFilled />
                  </span>
                )}
                <button
                  className="asset-del"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAsset(cat.key, asset.id);
                  }}
                  title="删除"
                >
                  <CloseOutlined />
                </button>
              </div>
            );
          })}

          {list.length === 0 && (
            <div className="gallery-empty">还没有素材，点左侧「上传」添加</div>
          )}
        </div>

        {pageCount > 1 && (
          <div className="gallery-pager">
            <Pagination
              simple
              size="small"
              current={cur}
              pageSize={PAGE_SIZE}
              total={list.length}
              onChange={(p) => setPage((prev) => ({ ...prev, [cat.key]: p }))}
            />
          </div>
        )}
      </>
    );
  }

  const stepItems = [
    { title: "🧍 人物" },
    { title: "👗 服饰搭配" },
    { title: "🏙️ 场景" },
    { title: "🎬 生成" },
  ];

  const summaryCats = [PERSON, ...OUTFIT.filter((c) => selectedAsset(c.key)), SCENE];

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: "#7c3aed", borderRadius: 10 } }}
    >
      <div className="page">
        <header className="hero">
          <Title level={2} style={{ color: "#fff", margin: 0 }}>
            👗 AI 虚拟换装
          </Title>
          <Paragraph style={{ color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
            按步骤上传并挑选素材，一步步搭配，最后生成换装图片与视频
          </Paragraph>
        </header>

        <main className="content">
          <Card className="section-card">
            <Steps current={current} items={stepItems} onChange={(v) => setCurrent(v)} responsive />
          </Card>

          {current < GENERATE_STEP ? (
            <>
              {current === 0 && (
                <Card
                  className="section-card"
                  title={
                    <span className="section-title">
                      🧍 第 1 步 · 人物<span className="req">*</span>
                    </span>
                  }
                >
                  <Paragraph type="secondary" style={{ marginTop: -4 }}>
                    上传人物照片，选择本次要换装的人
                  </Paragraph>
                  {renderGallery(PERSON)}
                </Card>
              )}

              {current === 1 && (
                <Card
                  className="section-card"
                  title={<span className="section-title">👗 第 2 步 · 服饰搭配（可选）</span>}
                >
                  <Paragraph type="secondary" style={{ marginTop: -4 }}>
                    按分类上传并挑选想换的单品，都可不选
                  </Paragraph>
                  <Tabs
                    items={OUTFIT.map((c) => ({
                      key: c.key,
                      label: `${c.icon} ${c.label}${selectedAsset(c.key) ? " ✓" : ""}`,
                      children: renderGallery(c),
                    }))}
                  />
                </Card>
              )}

              {current === 2 && (
                <Card
                  className="section-card"
                  title={
                    <span className="section-title">
                      🏙️ 第 3 步 · 场景<span className="req">*</span>
                    </span>
                  }
                >
                  <Paragraph type="secondary" style={{ marginTop: -4 }}>
                    上传场景照片，人物将在此场景中走动
                  </Paragraph>
                  {renderGallery(SCENE)}
                </Card>
              )}

              <div
                className="step-nav"
                style={{ justifyContent: current === 0 ? "flex-end" : "space-between" }}
              >
                {current > 0 && (
                  <Button
                    size="large"
                    icon={<LeftOutlined />}
                    onClick={() => setCurrent((s) => Math.max(s - 1, 0))}
                  >
                    上一步
                  </Button>
                )}
                <Button type="primary" size="large" onClick={goNext}>
                  下一步 <RightOutlined />
                </Button>
              </div>
            </>
          ) : (
            <>
              <Card
                className="section-card"
                title={<span className="section-title">🎬 第 4 步 · 确认搭配并生成</span>}
              >
                <div className="summary-row">
                  {summaryCats.map((cat) => {
                    const asset = selectedAsset(cat.key);
                    return (
                      <div className="summary-slot" key={cat.key}>
                        <div className={`summary-thumb ${asset ? "filled" : ""}`}>
                          {asset ? (
                            <img src={asset.url} alt={cat.label} />
                          ) : (
                            <span className="summary-placeholder">{cat.icon}</span>
                          )}
                        </div>
                        <div className="summary-label">
                          {cat.label}
                          {cat.required && <span className="req">*</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Paragraph style={{ marginTop: 20, marginBottom: 6 }}>额外描述（可选）</Paragraph>
                <Input.TextArea
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="例如：夜晚霓虹灯氛围、阳光明媚的午后、慢镜头特写……"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  maxLength={200}
                  showCount
                />

                <Space style={{ marginTop: 20 }} size="middle">
                  <Button size="large" icon={<LeftOutlined />} onClick={() => setCurrent(GENERATE_STEP - 1)}>
                    上一步
                  </Button>
                  <Button
                    type="primary"
                    size="large"
                    icon={<VideoCameraOutlined />}
                    loading={submitting}
                    onClick={onSubmit}
                  >
                    生成换装图片与视频
                  </Button>
                </Space>
              </Card>

              {task && (
                <Card
                  className="section-card result-card"
                  title={
                    <span className="section-title">
                      生成结果{" "}
                      <Tag color={STATUS_META[task.status].color}>
                        {STATUS_META[task.status].text}
                      </Tag>
                    </span>
                  }
                >
                  {task.status === "failed" ? (
                    <Result status="error" title="视频生成失败" subTitle={task.error || "请稍后重试"} />
                  ) : (
                    <div className="video-wrap">
                      <Segmented
                        value={resultView}
                        onChange={(v) => setResultView(v as "collage" | "image" | "video")}
                        options={[
                          { label: "🎨 搭配预览卡", value: "collage", disabled: !collageUrl },
                          { label: "🖼️ 换装图片", value: "image", disabled: !realImageUrl },
                          { label: "🎬 视频", value: "video", disabled: !videoReady },
                        ]}
                        style={{ marginBottom: 16 }}
                      />

                      {resultView === "collage" && (
                        <div>
                          {collageUrl ? (
                            <img src={collageUrl} alt="搭配预览卡" className="result-video" />
                          ) : (
                            <Spin />
                          )}
                          <Paragraph type="secondary" style={{ marginTop: 12 }}>
                            搭配预览卡（前端 Canvas 拼接，人物与单品分开展示，非真实换装）
                          </Paragraph>
                        </div>
                      )}

                      {resultView === "image" && (
                        <div>
                          {realImageUrl ? (
                            <>
                              <img src={realImageUrl} alt="换装图片" className="result-video" />
                              <Paragraph type="secondary" style={{ marginTop: 12 }}>
                                <Text type="success">✅ 真实换装定妆照（Seedream 生成）</Text>
                              </Paragraph>
                            </>
                          ) : (
                            <div className="generating-tip">
                              <Spin />
                              <Paragraph type="secondary" style={{ margin: "12px 0 0" }}>
                                {imageLoading ? "换装图生成中…可先看「搭配预览卡」" : "本次未生成换装图"}
                              </Paragraph>
                            </div>
                          )}
                        </div>
                      )}

                      {resultView === "video" && (
                        <div>
                          {videoReady ? (
                            <video
                              src={task.video_url!}
                              controls
                              autoPlay
                              loop
                              playsInline
                              className="result-video"
                            />
                          ) : (
                            <div className="generating-tip">
                              <Spin />
                              <Paragraph type="secondary" style={{ margin: "12px 0 0" }}>
                                视频生成中，每 3 秒自动刷新…
                              </Paragraph>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )}
            </>
          )}
        </main>
      </div>
    </ConfigProvider>
  );
}