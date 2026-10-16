"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, ChevronRight, GraduationCap, HeartHandshake, Leaf, LockKeyhole, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const scenes = [
  { name: "社团初见", time: "开学的第一周", question: "第一次社团破冰，你通常会……", a: "先在旁边观察一下，等熟悉了再聊。", b: "先说一句你好，看看能认识谁。", note: "安静与热情，都是打开世界的方式。" },
  { name: "朋友来信", time: "一个普通的周三", question: "朋友说今天有点难过，你会先……", a: "陪他理清事情，想想有什么办法。", b: "听他慢慢说，先接住他的情绪。", note: "给出办法和认真倾听，都是在意。" },
  { name: "周末出发", time: "周五 · 17:30", question: "突然空出来的周末，你更想……", a: "去熟悉的小店，留一点时间给自己。", b: "换条没走过的路，遇见点新鲜事。", note: "熟悉的安心，和未知的惊喜，都很好。" },
];
const characters = [
  { code: "INTP", label: "分析家", title: "泡面实验室", text: "一碗泡面，也想研究最佳配方。", art: "analyst", tone: "lilac" },
  { code: "INFP", label: "理想主义者", title: "朋友应急包", text: "包里有纸巾，也有对朋友的惦记。", art: "diplomat", tone: "sage" },
  { code: "ISFJ", label: "守护者", title: "社团后勤部", text: "大家还没开口，你已经准备好了。", art: "sentinel", tone: "sky" },
  { code: "ESFP", label: "探索者", title: "临时出发", text: "有趣的事，出发以后才知道。", art: "explorer", tone: "sand" },
];
const dimensions = [
  { name: "能量来源", letters: "I / E", width: 32, tone: "lilac" },
  { name: "信息偏好", letters: "S / N", width: 74, tone: "sage" },
  { name: "决策方式", letters: "T / F", width: 67, tone: "sky" },
  { name: "生活节奏", letters: "J / P", width: 80, tone: "sand" },
];

export function PersonalityIntro({ restored, answeredCount, onStart }: { restored: boolean; answeredCount: number; onStart: () => void }) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [choice, setChoice] = useState<"a" | "b" | null>(null);
  const scene = scenes[sceneIndex];
  const action = answeredCount === 32 ? "翻开我的性格手记" : restored ? "继续上次的探索" : "开始性格探索";
  return <div className="tp-home">
    <section className="tp-hero" aria-labelledby="hero-title">
      <div className="tp-hero-copy">
        <p className="tp-kicker"><span />校园生活 · 性格探索</p>
        <h1 id="hero-title">认识性格，<br /><span>也认识自己。</span></h1>
        <p className="tp-hero-description">从你熟悉的校园日常，找到自己的相处节奏。<br />每一种性格，都有自己的可爱之处。</p>
        <div className="tp-actions"><Button size="lg" onClick={onStart} className="premium-primary">{action}<ArrowRight size={17} /></Button><a href="#experience" className="tp-link">先随便看看 <ChevronRight size={16} /></a></div>
        <div className="tp-facts"><div><strong>32 个</strong><span>真实校园情境</span></div><div><strong>约 5 分钟</strong><span>轻松认识自己</span></div><div><strong>免登录</strong><span>进度自动保存</span></div></div>
        {restored && <p className="tp-resume"><span />{answeredCount === 32 ? "你的性格手记已经准备好了。" : `上次读到第 ${answeredCount} / 32 题，我们替你记着。`}</p>}
      </div>
      <div className="tp-hero-art">
        <span className="tp-art-index">TONGPIN FIELD NOTES / 01</span><div className="tp-art-arch" />
        <Image src="/personality/result-diplomat-v2.webp" alt="背着朋友应急包、带着纸巾和雨伞的校园水豚" width={460} height={460} priority sizes="(max-width: 700px) 340px, 460px" className="tp-hero-character" />
        <div className="tp-art-note"><HeartHandshake size={17} /><span>“刚好，我多带了一把伞。”</span></div>
        <div className="tp-art-profile"><span className="tp-profile-label">校园性格小剧场</span><strong>把温柔，装进日常。</strong><span className="tp-art-example">插画示意 · 不是你的测试结果</span></div>
        <div className="tp-art-dots" aria-hidden="true"><i /><i /><i /><i /></div>
      </div>
    </section>

    <section id="experience" className="tp-experience" aria-labelledby="experience-title">
      <div className="tp-section-heading"><div><p className="tp-kicker">01 / 从日常里，发现你</p><h2 id="experience-title">问题，就在校园生活里。</h2></div><p>不用想成为谁。<br />按平时的你选择就好。</p></div>
      <div className="tp-scene-layout">
        <div className="tp-scene-intro"><span className="tp-small-label">试着想一想</span><h3>这些瞬间，<br />是不是很熟悉？</h3><p>没有标准答案。<br />你的第一反应，就是线索。</p><div className="tp-scene-tabs" role="tablist" aria-label="校园情境预览">{scenes.map((item, i) => <button type="button" key={item.name} role="tab" id={`scene-tab-${i}`} aria-selected={sceneIndex === i} aria-controls="scene-preview" onClick={() => { setSceneIndex(i); setChoice(null); }}><span>0{i + 1}</span>{item.name}<ArrowUpRight size={15} /></button>)}</div></div>
        <div className="tp-scene-card" id="scene-preview" role="tabpanel" aria-labelledby={`scene-tab-${sceneIndex}`}><div className="tp-scene-top"><span><MessageCircle size={15} />{scene.name}</span><small>{scene.time}</small></div><h3>{scene.question}</h3><div className="tp-scene-options">{(["a", "b"] as const).map((key, i) => <button type="button" key={key} aria-pressed={choice === key} onClick={() => setChoice(key)} className={choice === key ? "is-chosen" : ""}><span>{i === 0 ? "A" : "B"}</span>{scene[key]}{choice === key && <Check size={17} />}</button>)}</div><p className="tp-scene-note" aria-live="polite">{choice ? scene.note : "这里只是情境预览，不计入测试。"}<Leaf size={16} /></p></div>
      </div>
    </section>

    <section className="tp-insights" aria-labelledby="insights-title"><div className="tp-section-heading"><div><p className="tp-kicker">02 / 两层结果，一份手记</p><h2 id="insights-title">你比四个字母，更丰富。</h2></div><button type="button" onClick={onStart} className="tp-link">发现我的性格 <ArrowUpRight size={16} /></button></div>
      <div className="tp-insight-grid"><article className="tp-dimension-card"><div className="tp-insight-top"><span className="tp-insight-icon tone-lilac">I / E</span><span className="tp-small-label">MBTI 四维倾向</span></div><h3>找到自然的偏好。</h3><p>独处还是热闹，确定还是自由。<br />看见每个维度里的倾向与细节。</p><div className="tp-dimension-bars" aria-label="四维倾向报告示例">{dimensions.map(d => <div key={d.name} className={`tone-${d.tone}`}><div><span>{d.name}</span><small>{d.letters}</small></div><div className="tp-dimension-track"><span style={{width: `${d.width}%`}} /></div></div>)}</div><span className="tp-example-label">报告示例，非实际测试结果</span></article>
      <article className="tp-relation-card"><div className="tp-insight-top"><span className="tp-insight-icon tone-sage"><HeartHandshake size={24} /></span><span className="tp-small-label">关系性格侧写</span></div><h3>靠近，也有自己的节奏。</h3><p>从联系到表达，从分歧到陪伴。<br />知道自己需要什么，也更懂如何理解彼此。</p><div className="tp-relation-pairs"><div><span>独立留白</span><i /><span>稳定陪伴</span></div><div><span>行动表达</span><i /><span>直接表达</span></div><div><span>冷静后谈</span><i /><span>及时说开</span></div></div><div className="tp-relation-note"><Leaf size={18} />舒服的相处，从理解自己的需要开始。</div></article></div>
    </section>

    <section className="tp-characters" aria-labelledby="characters-title"><div className="tp-section-heading"><div><p className="tp-kicker">03 / 校园性格小剧场</p><h2 id="characters-title">不同的你，都很有意思。</h2></div><p>一点熟悉，一点可爱。<br />看看哪一个让你忍不住点头。</p></div><div className="tp-character-grid">{characters.map(item => <Link key={item.code} href={`/test?type=${item.code.toLowerCase()}`} className={`tp-character-card tone-${item.tone}`} aria-label={`查看${item.code}性格报告示例`}><div className="tp-character-meta"><span>{item.label}</span><ArrowUpRight size={17} /></div><div className="tp-character-image"><Image src={`/personality/result-${item.art}-v2.webp`} alt={`${item.title}校园动物插画`} width={280} height={280} sizes="(max-width: 700px) 44vw, 260px" /></div><h3>{item.title}</h3><p>{item.text}</p><span className="tp-character-link">翻开报告示例 <ChevronRight size={13} /></span></Link>)}</div></section>

    <section id="about" className="tp-community" aria-labelledby="community-title"><div className="tp-community-copy"><p className="tp-kicker">同频，不止于测试</p><h2 id="community-title">从“原来你也喜欢”，<br />聊到“下次一起”。</h2><p>把性格当作话题的开头，把真实的相处留给你们。<br />一个面向全国高校学生的交流空间。</p><Link href="/match" className="tp-community-button">去同频社区逛逛 <ArrowRight size={17} /></Link><div className="tp-community-facts"><span><GraduationCap size={15} />高校身份认证</span><span><LockKeyhole size={14} />双向心意后私信</span></div></div><div className="tp-community-board"><span className="tp-small-label">共同话题示意</span><div className="tp-board-note"><span>校园散步</span><p>“你也会为了晚霞，<br />多绕操场一圈吗？”</p><div><span>摄影</span><span>音乐</span><span>慢慢来</span></div></div><div className="tp-board-response"><MessageCircle size={16} />从一个共同点开始，就很好。</div></div></section>

    <section className="tp-privacy" aria-labelledby="privacy-title"><span className="tp-privacy-icon"><LockKeyhole size={24} strokeWidth={1.5} /></span><div><h2 id="privacy-title">安心探索，慢慢认识。</h2><p>测试免登录，进度保存在当前设备。<br className="sm:hidden" />邮箱、学号和认证材料不向其他用户公开。</p></div><Button size="lg" onClick={onStart} className="premium-primary">开始我的探索<ArrowRight size={17} /></Button></section>
  </div>;
}
