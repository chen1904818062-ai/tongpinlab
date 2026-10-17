"use client";

import Link from "next/link";
import { ArrowRight, Check, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { CommunityViewer } from "@/lib/community-viewer";

export function ParticipationDialog({ viewer, target, reason, onClose }: { viewer: CommunityViewer; target: string | null; reason: string; onClose: () => void }) {
  const steps = [
    { title: "邮箱登录", done: viewer.authenticated, detail: "常用邮箱即可" },
    { title: "高校身份认证", done: viewer.campusVerified, detail: "高校邮箱 / 学信网 / 学生证" },
    { title: "个人资料", done: viewer.profileReady, detail: "让同学更好地认识你" },
    { title: "匹配问卷", done: viewer.questionnaireCompleted, detail: `${viewer.answeredCount} / ${viewer.total} 题已保存` },
  ];
  const onboarding = `/onboarding?return_to=${encodeURIComponent(target || "/community")}`;
  const url = viewer.authenticated ? onboarding : `/login?return_to=${encodeURIComponent(onboarding)}`;
  return <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="community-join-dialog"><DialogHeader><DialogTitle>{reason}前，先准备一下。</DialogTitle><DialogDescription>浏览可以慢慢来。发言、匹配和聊天需要完成下面四步，官方伙伴体验也一样。进度会保存，完成后回到刚才的位置。</DialogDescription></DialogHeader><ol className="community-checklist">{steps.map((step, i) => <li key={step.title} className={step.done ? "is-done" : ""}>{step.done ? <Check size={19} /> : <Circle size={19} />}<span><strong>{i + 1}. {step.title}</strong><small>{step.detail}</small></span><span>{step.done ? "已完成" : "待完成"}</span></li>)}</ol><Button asChild className="premium-primary"><Link href={url}>继续准备<ArrowRight size={16} /></Link></Button><p className="community-draft-note">当前动态或评论草稿会保留在本设备；不会自动代你发布。</p><button type="button" className="community-later" onClick={onClose}>先继续逛逛</button></DialogContent></Dialog>;
}
