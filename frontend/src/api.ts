export interface TaskState {
  id: string;
  status: "pending" | "running" | "succeeded" | "failed";
  video_url: string | null;
  error: string | null;
}

export interface GenerateResult {
  taskId: string;
  imageUrl: string | null;
}

export async function submitGenerate(form: FormData): Promise<GenerateResult> {
  const resp = await fetch("/api/generate", { method: "POST", body: form });
  if (!resp.ok) {
    const detail = await resp.json().catch(() => ({}));
    throw new Error(detail.detail || `提交失败 (${resp.status})`);
  }
  const data = await resp.json();
  return { taskId: data.task_id as string, imageUrl: (data.image_url as string) ?? null };
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