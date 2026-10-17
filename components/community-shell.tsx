"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Circle, Compass, Loader2 } from "lucide-react";
import { PremiumHeader } from "@/components/premium-header";
import { CompanionGuide } from "@/components/companion-guide";
import { SocialPlaza } from "@/components/social-plaza";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { restoreCommunityAccess } from "@/lib/community-client";
import type { CommunityViewer } from "@/lib/community-viewer";
import type { PlazaSnapshot } from "@/lib/plaza-types";

export function CommunityGate() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "missing" | "error">("checking");
  useEffect(() => {
    let active = true;
    void restoreCommunityAccess().then((restored) => { if (!active) return; if (restored) router.refresh(); else setStatus("missing"); }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [router]);
  return <main className="community-page"><PremiumHeader /><section className="community-entry"><span className="community-entry-icon"><Compass size={27} /></span><p className="tp-kicker">同频社区 · 先认识自己</p><h1>带着自己的频率，<br />去听听别人的故事。</h1><p>完成 32 题性格探索，就可以免登录浏览。<br />想发言或匹配时，再完成认证与资料。</p>{status === "checking" ? <p className="community-checking"><Loader2 size={16} className="animate-spin" />正在检查当前设备保存的测评…</p> : status === "error" ? <><p role="alert">暂时无法恢复浏览进度，请稍后重试。</p><Button onClick={() => window.location.reload()}>重新检查</Button></> : <Button asChild className="premium-primary"><Link href="/test">开始 / 继续性格测试<ArrowRight size={16} /></Link></Button>}<Link href="/" className="community-home-link">先回首页看看</Link></section></main>;
}
export function CommunityShell({ viewer, initialData }: { viewer: CommunityViewer; initialData: PlazaSnapshot }) {
  const router = useRouter();
  const [joinTarget, setJoinTarget] = useState<string | null>(null);
  const [joinReason, setJoinReason] = useState("参与讨论");
  function requireParticipation(reason: string, target = "/community") { setJoinReason(reason); setJoinTarget(target); }
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("join") === "matching" && !viewer.ready) queueMicrotask(() => { setJoinReason("开启匹配"); setJoinTarget("/match"); });
  }, [viewer.ready]);
  const steps = [
    { title: "邮箱登录", done: viewer.authenticated, detail: "常用邮箱即可" },
    { title: "高校身份认证", done: viewer.campusVerified, detail: "高校邮箱 / 学信网 / 学生证" },
    { title: "个人资料", done: viewer.profileReady, detail: "让同学更好地认识你" },
    { title: "匹配问卷", done: viewer.questionnaireCompleted, detail: `${viewer.answeredCount} / ${viewer.total} 题已保存` },
  ];
  const onboarding = `/onboarding?return_to=${encodeURIComponent(joinTarget || "/community")}`;
  const joinUrl = viewer.authenticated ? onboarding : `/login?return_to=${encodeURIComponent(onboarding)}`;
  return <main className="community-page"><PremiumHeader /><div className="community-main"><section className="community-welcome"><div><p className="tp-kicker">{viewer.personalityType} · 先从一个共同点开始</p><h1>来同频，听听校园里的不同声音。</h1><p>{viewer.ready ? `欢迎回来，${viewer.displayName}。可以发言，也可以慢慢逛。` : "现在可以自由浏览。想加入对话或认识新同学时，再完成准备。"}</p></div><div className="community-actions">{viewer.role === "admin" && <Link href="/admin">管理后台</Link>}<Button onClick={() => viewer.ready ? router.push("/match") : requireParticipation("开启匹配", "/match")}>认识同频同学<ArrowRight size={15} /></Button>{viewer.ready && <Link href="/match?tab=chat">我的私信</Link>}<Link href="/test">我的性格手记</Link></div></section><CompanionGuide personalityType={viewer.personalityType} />{!viewer.ready && <div className="community-browse-note"><span>正在以浏览模式逛广场 · 官方话题与明确公开的动态可见</span><button type="button" onClick={() => requireParticipation("加入社区")}>{steps.filter((step) => step.done).length} / 4 项准备已完成<ArrowRight size={14} /></button></div>}<SocialPlaza currentUserId={viewer.userId} initialData={initialData} canParticipate={viewer.ready} onRequireParticipation={requireParticipation} /></div>
    <Dialog open={joinTarget !== null} onOpenChange={(open) => { if (!open) setJoinTarget(null); }}><DialogContent className="community-join-dialog"><DialogHeader><DialogTitle>{joinReason}前，先准备一下。</DialogTitle><DialogDescription>浏览可以慢慢来。为了让交流来自真实高校同学，参与互动需要完成下面四步。进度会保存，完成后回到刚才的位置。</DialogDescription></DialogHeader><ol className="community-checklist">{steps.map((step, i) => <li key={step.title} className={step.done ? "is-done" : ""}>{step.done ? <Check size={19} /> : <Circle size={19} />}<span><strong>{i + 1}. {step.title}</strong><small>{step.detail}</small></span><span>{step.done ? "已完成" : "待完成"}</span></li>)}</ol><Button asChild className="premium-primary"><Link href={joinUrl}>继续准备<ArrowRight size={16} /></Link></Button><p className="community-draft-note">当前动态或评论草稿会保留在本设备；不会自动代你发布。</p><button type="button" className="community-later" onClick={() => setJoinTarget(null)}>先继续逛逛</button></DialogContent></Dialog>
  </main>;
}
