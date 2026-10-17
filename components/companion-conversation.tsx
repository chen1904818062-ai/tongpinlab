"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { companionScenes, getCompanion, type ExperienceState } from "@/lib/companion-experience";

async function request(url: string, body?: Record<string, unknown>) {
  const response = await fetch(url, { cache: "no-store", ...(body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json() as { data?: ExperienceState; error?: string };
  if (!response.ok || !result.data) throw new Error(result.error || "情境暂时无法加载，请稍后重试。");
  return result.data;
}
export function CompanionConversation({ companionId, onExit, onPlaza }: { companionId: string; onExit: () => void; onPlaza: () => void }) {
  const actor = getCompanion(companionId)!;
  const scenes = companionScenes.filter((scene) => scene.companionId === companionId);
  const [state, setState] = useState<ExperienceState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const feed = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const load = useCallback(async () => { setError(""); try { setState(await request(`/api/companions?companion=${encodeURIComponent(companionId)}`)); } catch (error) { setError(error instanceof Error ? error.message : "加载失败"); } }, [companionId]);
  useEffect(() => { let active = true; void request(`/api/companions?companion=${encodeURIComponent(companionId)}`).then((value) => { if (active) setState(value); }).catch((error: unknown) => { if (active) setError(error instanceof Error ? error.message : "加载失败"); }); return () => { active = false; }; }, [companionId]);
  useEffect(() => { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; }, [state]);
  async function act(action: "start" | "choose", value: string) {
    if (!state || inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try { setState(await request("/api/companions", { companionId, action, revision: state.revision, ...(action === "start" ? { sceneId: value } : { choiceId: value }) })); }
    catch (error) { toast.error(error instanceof Error ? error.message : "保存失败"); await load(); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <section className="experience-conversation"><header><button type="button" onClick={onExit} className="experience-exit"><ArrowLeft size={15} />结束体验</button><span>官方虚拟伙伴 · 点选情境练习</span></header><div className="experience-conversation-layout"><aside><Image src={actor.image} alt="" width={150} height={150} /><h2>{actor.name}<small>{actor.personalityType} · 角色设定</small></h2><p>{actor.opening}</p><p className="experience-scene-label">选择一个校园情境</p><div className="experience-scene-list">{scenes.map((scene) => <button key={scene.id} type="button" disabled={busy || !state} aria-pressed={state?.started && state.sceneId === scene.id} onClick={() => void act("start", scene.id)}>{scene.title}<small>{scene.intro}</small></button>)}</div><p className="experience-account-note">对话练习会保存到你的账号。这里的回应来自预设情境，不代表真人的意愿。</p></aside><div className="experience-chat"><div className="experience-chat-heading"><strong>{state?.started ? scenes.find((scene) => scene.id === state.sceneId)?.title : `和${actor.name}练习一句你好`}</strong><span>官方虚拟伙伴 · 预设回应</span></div><div className="experience-messages" ref={feed} aria-live="polite" aria-busy={busy}>{error ? <div className="experience-status" role="alert"><p>{error}</p><Button variant="outline" onClick={() => void load()}>重新加载</Button></div> : !state ? <p className="experience-status"><Loader2 size={18} className="animate-spin" />正在恢复你的练习…</p> : !state.started ? <div className="experience-welcome"><Image src={actor.image} alt="" width={110} height={110} /><h3>今天想从哪里开始？</h3><p>选择一个情境，再点选你愿意说的话。没有标准答案，也不会发送给真实同学。</p><Button onClick={() => void act("start", state.sceneId)} disabled={busy}>开始第一个情境<ArrowRight size={15} /></Button></div> : <>{state.messages.map((item) => <div key={item.id} className={`experience-message is-${item.role}`}><small>{item.role === "user" ? "你选择的回应" : `${actor.name} · 预设回应`}</small><p>{item.text}</p></div>)}{state.complete && <div className="experience-complete"><strong>这一段练习完成了。</strong><p>可以换个情境，也可以把真实经历带到广场。这里不会代你发布。</p><div><Button onClick={onPlaza}>去广场接一句<ArrowRight size={14} /></Button><Button variant="outline" onClick={() => void act("start", state.sceneId)} disabled={busy}><RotateCcw size={14} />再练一次</Button></div></div>}</>}</div>{state?.started && !state.complete && !error && <div className="experience-options"><p>选一句更像你的回应 · 进度自动保存</p>{state.options.map((option) => <button key={option.id} type="button" disabled={busy} onClick={() => void act("choose", option.id)}>{option.label}{busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}</button>)}</div>}</div></div></section>;
}
