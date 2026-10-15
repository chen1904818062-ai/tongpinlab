"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, BrainCircuit, Check, ChevronRight, Compass, GraduationCap, HeartHandshake, LockKeyhole, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const personalityLetters = [
  { left: "内向", right: "外向", value: 28 },
  { left: "实感", right: "直觉", value: 76 },
  { left: "思考", right: "情感", value: 68 },
  { left: "判断", right: "感知", value: 82 },
];

export function PersonalityIntro({ restored, answeredCount, onStart }: { restored: boolean; answeredCount: number; onStart: () => void }) {
  return <>
    <section className="personality-hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="premium-eyebrow"><span className="eyebrow-dot" />每一种性格，都有自己的频率</p>
        <h1 id="hero-title">更懂自己。<br /><span>更近同频。</span></h1>
        <p className="hero-description">从校园里的小选择，发现真实的你。<br className="hidden sm:block" />让每一次相遇，从理解开始。</p>
        <div className="hero-actions">
          <Button size="lg" onClick={onStart} className="premium-primary">
            {restored ? `继续测试 · ${answeredCount}/32` : "探索我的性格"}<ArrowRight size={17} />
          </Button>
          <a href="#experience" className="premium-text-link">了解测试 <ChevronRight size={17} /></a>
        </div>
        <p className="hero-facts">32 个校园情境<span />约 5 分钟<span />无需登录</p>
      </div>
      <PersonalityShowcase />
      <p className="showcase-caption">一份性格画像，一种认识自己的新方式。<span>示例结果 · 不代表你的测试结果</span></p>
    </section>

    <section id="experience" className="premium-section experience-section" aria-labelledby="experience-title">
      <div className="premium-section-heading">
        <p className="premium-eyebrow">从日常出发</p>
        <h2 id="experience-title">答案，就在你的生活里。</h2>
        <p>不用想成为谁，选更像自己的那一个。<br />32 个熟悉的校园瞬间，慢慢拼出你的性格轮廓。</p>
      </div>
      <div className="experience-grid">
        <article className="experience-card scene-experience">
          <div className="experience-label"><MessageCircle size={17} />真实校园情境<span>01</span></div>
          <div className="scene-visual" aria-hidden="true">
            <span className="scene-date">FRIDAY, 17:30</span>
            <div className="scene-bubble incoming">今晚有场演出，去不去？<span>刚刚</span></div>
            <div className="scene-bubble outgoing">走呀，一起发现点新鲜的。</div>
            <div className="scene-alternative">或者，留一点时间给自己。</div>
          </div>
          <h3>你的第一反应，<br />就是你的样子。</h3>
          <p>社团破冰、周末邀约、朋友求助。<br />没有标准答案，只有真实的选择。</p>
        </article>
        <article className="experience-card dimension-experience">
          <div className="experience-label"><BrainCircuit size={17} />MBTI 四维倾向<span>02</span></div>
          <div className="dimension-visual" aria-hidden="true">
            <div className="dimension-letters"><span>I</span><span>N</span><span>F</span><span>P</span></div>
            <div className="dimension-pill-row"><span>能量来源</span><span>信息偏好</span></div>
            <div className="dimension-pill-row"><span>决策方式</span><span>生活节奏</span></div>
          </div>
          <h3>四个字母之外，<br />看见更多细节。</h3>
          <p>理解每个维度的倾向与强度，<br />找到你习惯与世界相处的方式。</p>
        </article>
        <article className="experience-card relationship-experience">
          <div className="experience-label"><HeartHandshake size={17} />关系性格侧写<span>03</span></div>
          <div className="relationship-visual" aria-hidden="true">
            <div className="relationship-circle"><span /><span /><HeartHandshake size={44} strokeWidth={1.2} /></div>
            <div className="relationship-tags"><span>连接频率</span><span>情感表达</span><span>分歧处理</span><span>共同体验</span></div>
          </div>
          <h3>懂得如何相处，<br />让靠近更自然。</h3>
          <p>从联系到表达，从分歧到陪伴，<br />发现你在关系里在意的那些事。</p>
        </article>
      </div>
    </section>

    <section id="about" className="premium-section community-section" aria-labelledby="community-title">
      <div className="community-panel">
        <div className="community-copy">
          <p className="premium-eyebrow">同频，不止于性格</p>
          <h2 id="community-title">从认识自己，<br />到遇见新同学。</h2>
          <p>带着你的性格结果，走进全国高校社区。<br />从一个共同话题开始，让连接自然发生。</p>
          <Link href="/match" className="premium-text-link">探索同频社区 <ArrowUpRight size={17} /></Link>
          <div className="community-checks"><span><Check size={14} />高校身份认证</span><span><Check size={14} />双向心意后私信</span></div>
        </div>
        <div className="community-visual" aria-label="社区功能示意">
          <div className="community-orbit orbit-one" /><div className="community-orbit orbit-two" />
          <div className="orbit-avatar avatar-a">INFP</div><div className="orbit-avatar avatar-b">ENFJ</div><div className="orbit-avatar avatar-c">INTJ</div>
          <div className="community-mini-card"><span className="mini-card-icon"><Compass size={23} strokeWidth={1.5} /></span><small>从共同点开始</small><strong>原来，你也喜欢。</strong><span className="mini-card-tags"><span>摄影</span><span>音乐</span><span>校园散步</span></span><div className="mini-card-bottom"><GraduationCap size={14} />认证高校学生<ShieldCheck size={15} /></div></div>
          <span className="community-visual-caption">连接示意</span>
        </div>
      </div>
    </section>

    <section className="premium-section privacy-section" aria-labelledby="privacy-title">
      <LockKeyhole size={28} strokeWidth={1.4} />
      <h2 id="privacy-title">安心探索，自在连接。</h2>
      <p>测试无需注册，答题进度保存在当前设备。<br />进入社区后，邮箱、学号和认证材料不会向其他用户公开。</p>
      <div className="privacy-details"><span><ShieldCheck size={16} />认证后互动</span><span><LockKeyhole size={16} />私密信息保护</span><span><Sparkles size={16} />由你决定下一步</span></div>
      <Button size="lg" onClick={onStart} className="premium-primary">{restored ? "继续我的探索" : "开始我的探索"}<ArrowRight size={17} /></Button>
    </section>
  </>;
}

function PersonalityShowcase() {
  return <div className="personality-showcase" aria-label="性格报告示例：INFP 理想共鸣者">
    <div className="showcase-halo halo-one" aria-hidden="true" /><div className="showcase-halo halo-two" aria-hidden="true" />
    <article className="showcase-card showcase-side showcase-left">
      <div className="showcase-card-top"><HeartHandshake size={17} /><span>关系性格</span></div>
      <p className="side-card-title">靠近的方式，<br />也有你的频率。</p>
      <div className="connection-art" aria-hidden="true"><span /><span /><span /></div>
      <div className="side-trait"><span>连接频率</span><strong>自在留白</strong></div>
      <div className="side-trait"><span>情感表达</span><strong>行动派</strong></div>
      <div className="side-card-foot">理解彼此，从这里开始。</div>
    </article>
    <article className="showcase-card showcase-center">
      <div className="showcase-card-top"><span className="report-dot" /><span>你的性格画像</span><Compass size={18} strokeWidth={1.4} /></div>
      <div className="report-type">INFP<span>理想共鸣者</span></div>
      <p className="report-description">温柔地感受世界，<br />坚定地成为自己。</p>
      <div className="report-tags"><span>真诚</span><span>想象力</span><span>重价值</span></div>
      <div className="report-dimensions">{personalityLetters.map((item) => <div key={item.left}><div className="report-bar-label"><span>{item.left}</span><span>{item.right}</span></div><div className="report-bar"><span style={{ width: `${item.value}%` }} /></div></div>)}</div>
      <div className="report-bottom"><span>每一种性格，都值得被理解。</span><ArrowUpRight size={14} /></div>
    </article>
    <article className="showcase-card showcase-side showcase-right">
      <div className="showcase-card-top"><Sparkles size={16} /><span>校园性格小剧场</span></div>
      <div className="campus-art" aria-hidden="true"><span className="campus-art-sun" /><span className="campus-art-book book-one" /><span className="campus-art-book book-two" /><span className="campus-art-book book-three" /><span className="campus-art-ground" /></div>
      <p className="side-card-title">有自己的小宇宙，<br />也期待一点共鸣。</p>
      <p className="side-card-copy">耳机里的歌，书页里的故事，<br />都是认识你的线索。</p>
      <div className="side-card-foot">同频实验室 · 校园观察</div>
    </article>
  </div>;
}
