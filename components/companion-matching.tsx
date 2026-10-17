"use client";

import Image from "next/image";
import { ArrowRight, MessageCircle } from "lucide-react";
import { companionProfiles } from "@/lib/companion-experience";

export function CompanionMatching({ onChoose, hasCandidate }: { onChoose: (id: string) => void; hasCandidate: boolean }) {
  return <section className="experience-matching" aria-label="官方伙伴体验匹配"><div className="experience-heading"><div><p className="tp-kicker">官方虚拟伙伴 · 体验匹配</p><h2>{hasCandidate ? "想先练习开场，也可以找我们。" : "从一句你好开始，先和我们练习认识。"}</h2><p>小同和小频提供点选式校园情境对话。不会占用真人推荐，也不用等待双向选择。</p></div><MessageCircle size={24} /></div><div className="experience-match-grid">{companionProfiles.map((actor) => <article key={actor.id} className="experience-match-card"><div className="experience-card-art"><Image src={actor.image} alt={`${actor.species}${actor.name}的官方角色插画`} width={230} height={230} sizes="(max-width:700px) 150px,230px" /><span>官方虚拟伙伴</span></div><div className="experience-card-copy"><p>{actor.gender} · {actor.species} · {actor.role}</p><h3>{actor.name}<small>{actor.personalityType} · 角色设定</small></h3><p>{actor.bio}</p><div className="experience-interests">{actor.interests.map((item) => <span key={item}>{item}</span>)}</div><button type="button" onClick={() => onChoose(actor.id)}>开始体验匹配<ArrowRight size={15} /></button></div></article>)}</div><p className="experience-footnote">这是情境练习，不是真人或开放式 AI 聊天。完成登录、高校认证、资料和问卷后即可开始；你可以随时结束，继续查看真人推荐。</p></section>;
}
