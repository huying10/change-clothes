import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  ConfigProvider,
  Pagination,
  Result,
  Spin,
  Tag,
  Typography,
  Input,
  Upload,
  message,
} from "antd";
import {
  CheckCircleFilled,
  CloseOutlined,
  PlusOutlined,
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
}

const CATEGORIES: Category[] = [
  { key: "person", label: "人物", icon: "🧍", backendField: "person", required: true },
  { key: "clothing", label: "衣服", icon: "👗", backendField: "top" },
  { key: "accessory", label: "配饰", icon: "👜", backendField: "accessory" },
  { key: "scene", label: "场景", icon: "🏙️", backendField: "scene", required: true },
];

interface Asset {
  id: string;
  url: string;
  file: File;
}

const PAGE_SIZE = 4; // 每页展示的缩略图数量（不含上传瓦片）

const STATUS_META: Record<TaskState["status"], { color: string; text: string }> = {
  pending: { color: "default", text: "排队中" },
  running: { color: "processing", text: "生成中" },
  succeeded: { color: "success", text: "已完成" },
  failed: { color: "error", text: "失败" },
};

let assetSeq = 0;

export default function App() {
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
      // 跳到新素材所在的最后一页
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

  async function onSubmit() {
    if (!selectedAsset("person") || !selectedAsset("scene")) {
      message.warning("请先上传并选择「人物」和「场景」");
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
            每类可上传多张素材，挑选组成一身搭配，生成「换装后在场景中走动」的视频
          </Paragraph>
        </header>

        <main className="content">
          {/* 当前搭配预览 */}
          <Card className="section-card summary-card" title={<span className="section-title">🎬 当前搭配</span>}>
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
          </Card>

          {/* 各分类素材库（横向翻页） */}
          {CATEGORIES.map((cat) => {
            const list = library[cat.key] || [];
            const pageCount = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
            const current = Math.min(page[cat.key] || 1, pageCount);
            const start = (current - 1) * PAGE_SIZE;
            const pageItems = list.slice(start, start + PAGE_SIZE);
            return (
              <Card
                key={cat.key}
                className="section-card"
                title={
                  <span className="section-title">
                    {cat.icon} {cat.label}
                    {cat.required && <span className="req">*</span>}
                    {list.length > 0 && (
                      <Text type="secondary" style={{ fontWeight: 400, marginLeft: 8 }}>
                        共 {list.length} 张，点选其一
                      </Text>
                    )}
                  </span>
                }
              >
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
                        onClick={() =>
                          setSelection((prev) => ({ ...prev, [cat.key]: asset.id }))
                        }
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
                      current={current}
                      pageSize={PAGE_SIZE}
                      total={list.length}
                      onChange={(p) => setPage((prev) => ({ ...prev, [cat.key]: p }))}
                    />
                  </div>
                )}
              </Card>
            );
          })}

          {/* 额外描述 */}
          <Card className="section-card" title={<span className="section-title">✏️ 额外描述（可选）</span>}>
            <Input.TextArea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例如：夜晚霓虹灯氛围、阳光明媚的午后、慢镜头特写……"
              autoSize={{ minRows: 2, maxRows: 4 }}
              maxLength={200}
              showCount
            />
          </Card>

          <Button
            type="primary"
            size="large"
            block
            icon={<VideoCameraOutlined />}
            loading={submitting}
            onClick={onSubmit}
            className="submit-btn"
          >
            生成换装视频
          </Button>

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
        </main>
      </div>
    </ConfigProvider>
  );
}