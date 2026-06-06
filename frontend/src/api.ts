export interface TaskState {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  video_url: string | null;
  error: string | null;
}

export interface GenerateResult {
  images: Record<string, string>; // 模型标签 -> 换装图 url
  imageErrors: Record<string, string>; // 模型标签 -> 失败原因
  taskId: string | null; // 视频任务（暂停视频时为 null）
  videoEnabled: boolean;
}

export async function submitGenerate(form: FormData): Promise<GenerateResult> {
  const resp = await fetch("/api/generate", { method: "POST", body: form });
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}));
    throw new Error(detail.detail || `提交失败 (${resp.status})`);
  }
  const data = await resp.json();
  return {
    images: (data.images as Record<string, string>) ?? {},
    imageErrors: (data.image_errors as Record<string, string>) ?? {},
    taskId: (data.task_id as string) ?? null,
    videoEnabled: Boolean(data.video_enabled),
  };
}

export async function submitGenerateImage(form: FormData): Promise<string> {
  const resp = await fetch("/api/generate-image", { method: "POST", body: form });
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}));
    throw new Error(detail.detail || `换装图生成失败 (${resp.status})`);
  }
  const data = await resp.json();
  return data.image_url as string;
}

export async function fetchTask(id: string): Promise<TaskState> {
  const resp = await fetch(`/api/tasks/${id}`);
  if (!resp.ok) throw new Error(`查询失败 (${resp.status})`);
  return (await resp.json()) as TaskState;
}