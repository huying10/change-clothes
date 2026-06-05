import { useEffect, useRef, useState } from "react";
import { fetchTask, submitGenerate, type TaskState } from "./api";

const FIELDS: { name: string; label: string; required?: boolean }[] = [
  { name: "person", label: "人物照片", required: true },
  { name: "scene", label: "场景照片", required: true },
  { name: "top", label: "上衣" },
  { name: "bottom", label: "裤子" },
  { name: "shoes", label: "鞋子" },
  { name: "jewelry", label: "首饰" },
  { name: "accessory", label: "配饰" },
];

export default function App() {
  const [task, setTask] = useState<TaskState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!task || task.status === "succeeded" || task.status === "failed") return;
    timer.current = window.setInterval(async () => {
      try {
        setTask(await fetchTask(task.id));
      } catch (e) {
        setError(String(e));
      }
    }, 3000);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [task?.id, task?.status]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      for (const f of FIELDS) {
        const file = form.get(f.name) as File | null;
        if (file && file.size === 0) form.delete(f.name);
      }
      const id = await submitGenerate(form);
      setTask({ id, status: "pending", video_url: null, error: null });
    } catch (e) {
      setError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1>AI 虚拟换装视频</h1>
      <form onSubmit={onSubmit}>
        <div className="grid">
          {FIELDS.map((f) => (
            <label key={f.name} className="field">
              <span>{f.label}{f.required && " *"}</span>
              <input type="file" name={f.name} accept="image/*" required={f.required} />
            </label>
          ))}
        </div>
        <label className="field">
          <span>额外描述（可选）</span>
          <input type="text" name="custom_prompt" placeholder="如：夜晚霓虹灯氛围" />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "提交中…" : "生成换装视频"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {task && (
        <div className="result">
          <p>任务状态：<b>{task.status}</b></p>
          {(task.status === "pending" || task.status === "running") && (
            <p>生成中，请稍候…（每 3 秒自动刷新）</p>
          )}
          {task.status === "failed" && <p className="error">失败：{task.error}</p>}
          {task.status === "succeeded" && task.video_url && (
            <video src={task.video_url} controls autoPlay loop width={360} />
          )}
        </div>
      )}
    </div>
  );
}