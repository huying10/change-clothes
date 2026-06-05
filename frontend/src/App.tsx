import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  ConfigProvider,
  Input,
  Pagination,
  Result,
  Space,
  Spin,
  Steps,
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

const { Title, Paragraph, Text } = Typography;

interface Category {
  key: string;
  label: string;
  icon: string;
  backendField: string;
  required?: boolean;
  hint: string;
}

const CATEGORIES: Category[] = [
  { key: "person", label: "人物", icon: "🧍", backendField: "person", required: true, hint: "上传人物照片，选择本次要换装的人" },
  { key: "clothing", label: "衣服", icon: "👗", backendField: "top", hint: "上传想试的衣服（可不选）" },
  { key: "accessory", label: "配饰", icon: "👜", backendField: "accessory", hint: "上传想搭配的配饰（可不选）" },
  { key: "scene", label: "场景", icon: "🏙️", backendField: "scene", required: true, hint: "上传场景照片，人物将在此场景中走动" },
];

const GENERATE_STEP = CATEGORIES.length; // 最后一步：确认并生成

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
    const cat = CATEGORIES[current];
    if (cat?.required && !selectedAsset(cat.key)) {
      message.warning(`请先上传并选择「${cat.label}」`);
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
    try {
      const form = new FormData();
      for (const cat of CATEGORIES) {
        const asset = selectedAsset(cat.key);
        if (asset) form.append(cat.backendField, asset.file);
      }
      if (customPrompt.trim()) form.append("custom_prompt", customPrompt.trim());
      const id = await submitGenerate(form);
      setTask({ id, status: "pending", video_url: null, error: null });
      message.success("已提交，开始生成");
    } catch (e) {
      message.error(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const isGenerating = task && (task.status === "pending" || task.status === "running");

  // 渲染某一类的素材库（上传 + 翻页画廊）
  function renderGallery(cat: Category) {
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
    ...CATEGORIES.map((c) => ({ title: `${c.icon} ${c.label}` })),
    { title: "🎬 生成" },
  ];

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{ token: { colorPrimary: "#7c3aed", borderRadius: 10 } }}
    >
      <div className="page">
        <header className="hero">
          <Title level={2} style={{ color: "#fff", margin: 0 }}>
            👗 AI 虚拟换装视频
          </Title>
          <Paragraph style={{ color: "rgba(255,255,255,0.85)", marginTop: 8 }}>
            按步骤上传并挑选素材，一步步搭配，最后生成换装视频
          </Paragraph>
        </header>

        <main className="content">
          <Card className="section-card">
            <Steps
              current={current}
              items={stepItems}
              onChange={(v) => setCurrent(v)}
              responsive
            />
          </Card>

          {current < GENERATE_STEP ? (
            <>
              <Card
                className="section-card"
                title={
                  <span className="section-title">
                    {CATEGORIES[current].icon} 第 {current + 1} 步 · {CATEGORIES[current].label}
                    {CATEGORIES[current].required && <span className="req">*</span>}
                  </span>
                }
              >
                <Paragraph type="secondary" style={{ marginTop: -4 }}>
                  {CATEGORIES[current].hint}
                </Paragraph>
                {renderGallery(CATEGORIES[current])}
              </Card>

              <div className="step-nav">
                <Button
                  size="large"
                  icon={<LeftOutlined />}
                  disabled={current === 0}
                  onClick={() => setCurrent((s) => Math.max(s - 1, 0))}
                >
                  上一步
                </Button>
                <Button type="primary" size="large" onClick={goNext}>
                  下一步 <RightOutlined />
                </Button>
              </div>
            </>
          ) : (
            <>
              <Card
                className="section-card"
                title={<span className="section-title">🎬 确认搭配并生成</span>}
              >
                <div className="summary-row">
                  {CATEGORIES.map((cat) => {
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

                <Paragraph style={{ marginTop: 20, marginBottom: 6 }}>
                  额外描述（可选）
                </Paragraph>
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
                    生成换装视频
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
                  {isGenerating && (
                    <div className="generating">
                      <Spin size="large" />
                      <Paragraph type="secondary" style={{ marginTop: 16 }}>
                        正在生成换装视频，每 3 秒自动刷新…
                      </Paragraph>
                    </div>
                  )}
                  {task.status === "failed" && (
                    <Result status="error" title="生成失败" subTitle={task.error || "请稍后重试"} />
                  )}
                  {task.status === "succeeded" && task.video_url && (
                    <div className="video-wrap">
                      <video
                        src={task.video_url}
                        controls
                        autoPlay
                        loop
                        playsInline
                        className="result-video"
                      />
                      <Paragraph type="secondary" style={{ marginTop: 12 }}>
                        <Text type="warning">提示：</Text>
                        当前若为 Mock 模式，这里是占位测试视频；切换到 volcengine
                        模式后即为 Seedance 2.0 生成的真实换装视频。
                      </Paragraph>
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