import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  ConfigProvider,
  Image,
  Input,
  Result,
  Spin,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd";
import zhCN from "antd/locale/zh_CN";
import { fetchTask, submitGenerate, type TaskState } from "./api";

const { Title, Paragraph, Text } = Typography;

interface FieldDef {
  name: string;
  label: string;
  icon: string;
  required?: boolean;
}

const PRIMARY: FieldDef[] = [
  { name: "person", label: "人物照片", icon: "🧍", required: true },
  { name: "scene", label: "场景照片", icon: "🏙️", required: true },
];

const ITEMS: FieldDef[] = [
  { name: "top", label: "上衣", icon: "👕" },
  { name: "bottom", label: "裤子", icon: "👖" },
  { name: "shoes", label: "鞋子", icon: "👟" },
  { name: "jewelry", label: "首饰", icon: "💍" },
  { name: "accessory", label: "配饰", icon: "👜" },
];

const ALL_FIELDS = [...PRIMARY, ...ITEMS];

const STATUS_META: Record<
  TaskState["status"],
  { color: string; text: string }
> = {
  pending: { color: "default", text: "排队中" },
  running: { color: "processing", text: "生成中" },
  succeeded: { color: "success", text: "已完成" },
  failed: { color: "error", text: "失败" },
};

function getBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

export default function App() {
  const [fileLists, setFileLists] = useState<Record<string, UploadFile[]>>({});
  const [customPrompt, setCustomPrompt] = useState("");
  const [task, setTask] = useState<TaskState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const timer = useRef<number | null>(null);

  // 轮询任务状态
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

  const handlePreview = async (file: UploadFile) => {
    let url = file.url || (file.preview as string | undefined);
    if (!url && file.originFileObj) {
      url = await getBase64(file.originFileObj as File);
      file.preview = url;
    }
    setPreviewImage(url || "");
    setPreviewOpen(true);
  };

  const renderUpload = (f: FieldDef) => {
    const list = fileLists[f.name] || [];
    const filled = list.length >= 1;
    return (
      <div className="upload-field" key={f.name}>
        <Upload
          listType="picture-card"
          accept="image/*"
          maxCount={1}
          fileList={list}
          beforeUpload={() => false}
          onChange={({ fileList }) =>
            setFileLists((prev) => ({ ...prev, [f.name]: fileList }))
          }
          onPreview={handlePreview}
        >
          {filled ? null : (
            <div className="upload-trigger">
              <div className="upload-icon">{f.icon}</div>
              <div className="upload-label">
                {f.label}
                {f.required && <span className="req">*</span>}
              </div>
              <div className="upload-hint">点击上传</div>
            </div>
          )}
        </Upload>
        {filled && (
          <div className="upload-caption">
            {f.icon} {f.label}
          </div>
        )}
      </div>
    );
  };

  async function onSubmit() {
    const person = fileLists["person"]?.[0]?.originFileObj;
    const scene = fileLists["scene"]?.[0]?.originFileObj;
    if (!person || !scene) {
      message.warning("请至少上传「人物照片」和「场景照片」");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      for (const f of ALL_FIELDS) {
        const file = fileLists[f.name]?.[0]?.originFileObj as File | undefined;
        if (file) form.append(f.name, file);
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

  const isGenerating =
    task && (task.status === "pending" || task.status === "running");

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
            上传人物与场景，挑选要换的单品，一键生成「换装后在该场景走动」的视频
          </Paragraph>
        </header>

        <main className="content">
          <Card
            className="section-card"
            title={<span className="section-title">① 上传人物与场景（必填）</span>}
          >
            <div className="uploads primary-uploads">
              {PRIMARY.map(renderUpload)}
            </div>
          </Card>

          <Card
            className="section-card"
            title={<span className="section-title">② 选择要换的单品（可选）</span>}
          >
            <div className="uploads item-uploads">{ITEMS.map(renderUpload)}</div>
          </Card>

          <Card
            className="section-card"
            title={<span className="section-title">③ 额外描述（可选）</span>}
          >
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
                <Result
                  status="error"
                  title="生成失败"
                  subTitle={task.error || "请稍后重试"}
                />
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

        {previewImage && (
          <Image
            wrapperStyle={{ display: "none" }}
            preview={{
              visible: previewOpen,
              onVisibleChange: (v) => setPreviewOpen(v),
              afterOpenChange: (v) => !v && setPreviewImage(""),
            }}
            src={previewImage}
          />
        )}
      </div>
    </ConfigProvider>
  );
}