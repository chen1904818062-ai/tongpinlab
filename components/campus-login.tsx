"use client";

import { BrandMark } from "@/components/brand-mark";

import { useState } from "react";
import { PremiumHeader } from "@/components/premium-header";
import { ArrowRight, BadgeCheck, HeartHandshake, Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

async function post<T>(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as { ok: boolean; data?: T; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "操作失败");
  return result.data as T;
}

export function CampusLogin({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    try {
      const result = await post<{ delivery: "email" | "demo"; demoCode?: string }>("/api/auth/email/send", { email });
      setSent(true);
      setDemoCode(result.demoCode || "");
      toast.success(result.delivery === "email" ? "注册 / 登录验证码已发送" : "本地演示验证码已生成");
    } catch (error) { toast.error(error instanceof Error ? error.message : "发送失败"); }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    setBusy(true);
    try {
      const result = await post<{ redirectTo: string }>("/api/auth/email/verify", { email, code, returnTo });
      window.localStorage.setItem("campus-login-email", email.trim().toLowerCase());
      window.location.replace(result.redirectTo);
    } catch (error) { toast.error(error instanceof Error ? error.message : "登录失败"); setBusy(false); }
  }

  return <main className="premium-login min-h-screen overflow-hidden">
    <PremiumHeader />
    <div className="premium-login-layout">
      <section className="premium-login-story">
        <p className="premium-eyebrow">先从一句你好开始</p>
        <h1>在这里，<br /><span>慢慢认识彼此。</span></h1>
        <p>一个属于高校学生的相遇空间。先从一个共同点开始，再慢慢了解彼此。</p>
        <div className="login-benefits">
          <Feature icon={<BadgeCheck />} title="真实的校园身份" text="全国高校认证，让交流更安心" />
          <Feature icon={<HeartHandshake />} title="从理解开始认识" text="性格结果自动带入，找到更多共同话题" />
          <Feature icon={<LockKeyhole />} title="尊重每一步选择" text="双向心意后开启私信，保留舒服的边界" />
        </div>
      </section>
      <section className="premium-login-card" aria-labelledby="login-title">
        <span className="login-card-icon"><BrandMark /></span>
        <h2 id="login-title">先打个招呼。</h2>
        <p>使用常用邮箱登录，首次验证即创建账号。<br />高校身份将在下一步单独认证。</p>
        <form className="mt-7 space-y-5" onSubmit={(event) => { event.preventDefault(); if (!busy && email.includes("@") && (!sent || code.length === 6)) void (sent ? verifyCode() : sendCode()); }}>
          <div><label htmlFor="login-email" className="mb-2 block">邮箱地址</label><Input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></div>
          {sent && <div><label htmlFor="login-code" className="mb-2 block">6 位验证码</label><Input id="login-code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="输入验证码" className="tracking-[.35em]" /><p className="mt-2 text-xs text-[#86868b]" role="status">验证码已发送，请查看邮箱。</p></div>}
          {demoCode && <div className="rounded-xl border border-[#e0e8e1] bg-[#f1f6f2] p-3 text-sm text-[#286451]">本地演示验证码：<strong>{demoCode}</strong></div>}
          <Button type="submit" size="lg" disabled={busy || !email.includes("@") || (sent && code.length !== 6)} className="w-full bg-[#286451] font-medium hover:bg-[#205340]">{busy ? <Loader2 className="size-4 animate-spin" /> : sent ? <ArrowRight className="size-4" /> : <Mail className="size-4" />}{busy ? "请稍候…" : sent ? "登录并继续" : "获取验证码"}</Button>
          {sent && <button type="button" disabled={busy} onClick={sendCode} className="w-full text-xs text-[#286451] hover:underline">重新获取验证码</button>}
        </form>
        <div className="login-privacy"><LockKeyhole size={13} /><span>邮箱仅用于登录与身份验证。你的邮箱和认证材料不会向其他用户公开。</span></div>
      </section>
    </div>
  </main>;
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="login-benefit"><span>{icon}</span><div><strong>{title}</strong><small>{text}</small></div></div>;
}
