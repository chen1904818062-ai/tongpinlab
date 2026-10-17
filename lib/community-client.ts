export async function restoreCommunityAccess() {
  let body: Record<string, unknown> | null = null;
  try {
    const progress = JSON.parse(localStorage.getItem("campus-personality-v2") || "null") as { answers?: unknown[] } | null;
    if (Array.isArray(progress?.answers) && progress.answers.length === 32 && progress.answers.every((value) => Number.isInteger(value) && Number(value) >= -2 && Number(value) <= 2)) body = { answers: progress.answers };
    else {
      const result = JSON.parse(localStorage.getItem("campus-personality-result-v1") || "null") as { source?: string } | null;
      if (result?.source === "wx-mini") body = { result };
    }
  } catch { return false; }
  if (!body) return false;
  const response = await fetch("/api/community/access", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "暂时无法恢复浏览进度，请稍后重试。");
  return true;
}
