"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { companions, companionQuestions } from "@/lib/companions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function CompanionGuide({ personalityType = "" }: { personalityType?: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [question, setQuestion] = useState<string>("result");
  const actor = companions[selected ?? 0];
  const current = companionQuestions.find((item) => item.id === question);
  const questions = companionQuestions.filter((item) => item.companion === selected);
  return <section className="companion-section" aria-label="认识两位官方虚拟伙伴">
    <div className="companion-heading"><div><p className="tp-kicker">先认识两位新朋友</p><h2>小同和小频，陪你慢慢逛。</h2></div><span>官方虚拟伙伴 · 可在今日同频体验匹配</span></div>
    <div className="companion-grid">{companions.map((item, i) => <article key={item.id} className="companion-card"><Image src={item.image} alt={`${item.name}的${item.species}形象`} width={120} height={120} sizes="120px" /><div><span className="companion-label">{item.gender} · {item.species} · {item.role}</span><h3>{item.name}<small>官方虚拟伙伴</small></h3><p>{item.intro}</p><button type="button" onClick={() => { setSelected(i); setQuestion(i === 0 ? "result" : "hello"); }}>问问{item.name}<ArrowUpRight size={14} /></button></div></article>)}</div>
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="companion-dialog"><DialogHeader><DialogTitle>和{actor.name}逛逛同频</DialogTitle><DialogDescription>官方虚拟伙伴 · 点选问题查看预设产品说明，并非真人或开放式 AI 聊天。</DialogDescription></DialogHeader><div className="companion-dialog-body"><div className="companion-dialog-avatar"><Image src={actor.image} alt="" width={96} height={96} /><div><strong>{actor.name} · {actor.role}</strong><p>{personalityType ? `带着你的 ${personalityType} 倾向，一起看看。` : "先了解玩法，再决定要不要参与。"}</p></div></div><div className="companion-question-list">{questions.map((item) => <button key={item.id} type="button" onClick={() => setQuestion(item.id)} aria-pressed={question === item.id}>{item.question}</button>)}</div><div className="companion-answer" aria-live="polite"><MessageCircle size={18} /><p>{current?.answer}</p></div></div></DialogContent></Dialog>
  </section>;
}
