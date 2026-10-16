"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Compass, Fingerprint, GraduationCap, HeartHandshake, LockKeyhole, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const dimensions = [
  { name: "能量来源", left: "I", right: "E", width: 28 },
  { name: "信息偏好", left: "S", right: "N", width: 76 },
  { name: "决策方式", left: "T", right: "F", width: 68 },
  { name: "生活节奏", left: "J", right: "P", width: 82 },
];

export function PersonalityIntro({ restored, answeredCount, onStart }: { restored: boolean; answeredCount: number; onStart: () => void }) {
  const action = answeredCount === 32 ? "查看我的性格报告" : restored ? `继续探索 · ${answeredCount}/32` : "探索我的性格";
  return <div className="tp-home">
    <div className="tp-announcement">从认识自己开始，发现校园里的更多可能。<a href="#experience">了解同频 <ChevronRight size={13} /></a></div>
    <section className="tp-hero" aria-labelledby="hero-title">
      <p className="tp-kicker">同频实验室</p>
      <h1 id="hero-title">你的频率。<br /><span>自有共鸣。</span></h1>
      <p className="tp-hero-description">更懂自己一点。更近彼此一步。</p>
      <div className="tp-actions"><Button size="lg" onClick={onStart} className="premium-primary">{action}<ArrowRight size={16} /></Button><Link href="/match" className="tp-link">探索社区 <ChevronRight size={17} /></Link></div>
      <p className="tp-meta">32 个校园情境 · 约 5 分钟 · 无需登录</p>
      <div className="tp-hero-art" role="img" aria-label="蓝色与紫色的频率光环交汇，象征独特性格与彼此共鸣">
        <div className="tp-orb tp-orb-one" /><div className="tp-orb tp-orb-two" />
        <div className="tp-frequency">{Array.from({ length: 15 }, (_, i) => <i key={i} />)}</div>
        <span className="tp-art-word">Be yourself.</span><span className="tp-art-caption">每一种性格，都有自己的光。</span>
      </div>
    </section>
    <section id="experience" className="tp-experience" aria-labelledby="experience-title">
      <div className="tp-section-heading"><p className="tp-kicker">为真实的你而设计</p><h2 id="experience-title">一点点选择。<br /><span>看见完整的自己。</span></h2><p>从熟悉的校园日常出发，发现你的性格倾向，<br className="hidden sm:block" />也看见自己与世界相处的方式。</p></div>
      <div className="tp-features">
        <article className="tp-feature"><MessageCircle className="tp-feature-icon" size={26} strokeWidth={1.4} /><span className="tp-feature-number">01</span><h3>答案，就在日常里。</h3><p>社团破冰、周末邀约、朋友求助。<br />没有标准答案，只选更像你的那个。</p><div className="tp-chat" aria-hidden="true"><span>周末，出去走走？</span><span>好呀，发现点新鲜的。</span></div></article>
        <article className="tp-feature"><Fingerprint className="tp-feature-icon" size={26} strokeWidth={1.4} /><span className="tp-feature-number">02</span><h3>四个字母，更多细节。</h3><p>从能量来源到生活节奏，<br />理解每个维度里的独特倾向。</p><div className="tp-type-letters" aria-hidden="true">INFP</div></article>
        <article className="tp-feature"><HeartHandshake className="tp-feature-icon" size={26} strokeWidth={1.4} /><span className="tp-feature-number">03</span><h3>靠近，也有你的方式。</h3><p>怎样表达在意，如何处理分歧。<br />发现让你自在的关系节奏。</p><div className="tp-connection" aria-hidden="true"><i /><i /><span>彼此理解，自然共鸣。</span></div></article>
      </div>
    </section>
    <section className="tp-report-section" aria-labelledby="report-title">
      <div className="tp-report-copy"><p className="tp-kicker">不止一个性格标签</p><h2 id="report-title">你，<br />值得细细了解。</h2><p>一份属于你的性格画像。<br />有维度，有细节，也有校园生活里的小小共鸣。</p><button type="button" onClick={onStart} className="tp-link">发现我的性格 <ChevronRight size={17} /></button><div className="tp-report-note"><span>MBTI 四维倾向</span><span>关系性格侧写</span><span>校园性格小剧场</span></div></div>
      <article className="tp-report" aria-label="性格报告示例，非个人实际测试结果"><div className="tp-report-top"><span><Compass size={16} />性格画像</span><span>示例报告</span></div><strong className="tp-report-type">INFP</strong><h3>理想共鸣者</h3><p>温柔地感受世界，<br />坚定地成为自己。</p><div className="tp-report-tags"><span>真诚</span><span>想象力</span><span>重价值</span></div><div className="tp-report-bars">{dimensions.map((d) => <div key={d.name}><div><span>{d.name}</span><span>{d.left}<b> / </b>{d.right}</span></div><div className="tp-report-track"><span style={{ width: `${d.width}%` }} /></div></div>)}</div><div className="tp-report-bottom">每一种性格，都值得被理解。<Fingerprint size={20} /></div></article>
    </section>
    <section id="about" className="tp-community" aria-labelledby="community-title"><div className="tp-community-copy"><p className="tp-kicker">同频，不止于性格</p><h2 id="community-title">有共同点。<br /><span>才有下一句。</span></h2><p>带着真实的自己，走进全国高校社区。<br />从喜欢的歌、走过的路，聊到彼此的世界。</p><Link href="/match" className="tp-light-button">探索同频社区 <ArrowRight size={16} /></Link><div className="tp-community-details"><span><GraduationCap size={16} />高校身份认证</span><span><HeartHandshake size={16} />双向心意后私信</span></div></div><div className="tp-community-art" aria-label="不同性格通过共同兴趣建立连接的示意"><div className="tp-community-ring" /><div className="tp-community-ring tp-community-ring-two" /><span className="tp-person tp-person-one">INFP<small>音乐 · 散步</small></span><span className="tp-person tp-person-two">ENFJ<small>电影 · 摄影</small></span><span className="tp-person tp-person-three">INTJ<small>阅读 · 旅行</small></span><div className="tp-community-center"><Compass size={40} strokeWidth={1} /><span>很高兴，同频。</span></div></div></section>
    <section className="tp-privacy" aria-labelledby="privacy-title"><span className="tp-privacy-icon"><LockKeyhole size={32} strokeWidth={1.3} /></span><p className="tp-kicker">安心，是一切的开始</p><h2 id="privacy-title">自在探索。<br />也被好好保护。</h2><p>测试无需注册，答题进度保存在当前设备。<br />你的邮箱、学号和认证材料，不会向其他用户公开。</p><Button size="lg" onClick={onStart} className="premium-primary">{action}<ArrowRight size={16} /></Button></section>
  </div>;
}
