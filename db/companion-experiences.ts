import "server-only";
import { getD1 } from "@/db";
import { assertParticipationReady } from "@/lib/participation";
import { companionScenes, experienceState, getCompanion, getCompanionScene, type ExperienceState } from "@/lib/companion-experience";

type Row = { scene_id: string; choices_json: string; revision: number };
export class CompanionConflictError extends Error {}
function actor(id: string) { if (!getCompanion(id)) throw new Error("请选择有效的官方虚拟伙伴。"); }
async function row(userId: string, companionId: string) {
  return getD1().prepare("SELECT scene_id, choices_json, revision FROM companion_experiences WHERE user_id = ? AND companion_id = ?").bind(userId, companionId).first<Row>();
}
function state(companionId: string, saved: Row) {
  const choices: unknown = JSON.parse(saved.choices_json);
  if (!Array.isArray(choices) || !choices.every((value) => typeof value === "string")) throw new Error("情境记录无效。");
  return experienceState(companionId, saved.scene_id, choices, Number(saved.revision));
}
export async function getCompanionExperience(userId: string, companionId: string): Promise<ExperienceState> {
  await assertParticipationReady(userId); actor(companionId);
  const saved = await row(userId, companionId);
  if (saved) return state(companionId, saved);
  return { companionId, sceneId: companionScenes.find((scene) => scene.companionId === companionId)!.id, revision: 0, started: false, complete: false, messages: [], options: [] };
}
export async function updateCompanionExperience(userId: string, input: Record<string, unknown>) {
  await assertParticipationReady(userId);
  const companionId = String(input.companionId || ""); actor(companionId);
  if (typeof input.revision !== "number" || !Number.isInteger(input.revision) || input.revision < 0) throw new Error("对话版本无效，请刷新后重试。");
  const current = await row(userId, companionId);
  if (Number(current?.revision || 0) !== input.revision) throw new CompanionConflictError("对话已在其他页面更新，请刷新后继续。");
  let sceneId: string;
  let choices: string[];
  if (input.action === "start") {
    sceneId = String(input.sceneId || "");
    if (!getCompanionScene(companionId, sceneId)) throw new Error("请选择这位伙伴提供的校园情境。");
    choices = [];
  } else if (input.action === "choose" && current) {
    const view = state(companionId, current);
    if (!view.options.some((option) => option.id === input.choiceId)) throw new Error("请选择当前对话提供的回应。");
    sceneId = current.scene_id;
    choices = [...JSON.parse(current.choices_json) as string[], String(input.choiceId)];
  } else throw new Error("请先选择情境，再继续对话。");
  const revision = input.revision + 1;
  const view = experienceState(companionId, sceneId, choices, revision);
  const db = getD1();
  const result = current
    ? await db.prepare("UPDATE companion_experiences SET scene_id = ?, choices_json = ?, revision = ?, updated_at = ? WHERE user_id = ? AND companion_id = ? AND revision = ?").bind(sceneId, JSON.stringify(choices), revision, new Date().toISOString(), userId, companionId, input.revision).run()
    : await db.prepare("INSERT INTO companion_experiences (user_id, companion_id, scene_id, choices_json, revision, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, companion_id) DO NOTHING").bind(userId, companionId, sceneId, JSON.stringify(choices), revision, new Date().toISOString()).run();
  if (!result.meta.changes) throw new CompanionConflictError("对话已在其他页面更新，请刷新后继续。");
  return view;
}
