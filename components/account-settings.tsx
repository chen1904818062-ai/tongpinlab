"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Loader2, Mail, ShieldCheck, Trash2 } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

async function accountAction(body: Record<string, unknown>) {
  const response = await fetch("/api/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "操作失败，请稍后再试。");
  return result.data;
}
export function AccountSettings({ userId, email, displayName }: { userId: string; email: string; displayName: string }) {
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false), [code, setCode] = useState(""), [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false), [remaining, setRemaining] = useState(0), [demo, setDemo] = useState(""), [error, setError] = useState("");
  useEffect(() => { if (remaining <= 0) return; const timer = window.setTimeout(() => setRemaining(value => value - 1), 1000); return () => window.clearTimeout(timer); }, [remaining]);
  async function send() {
    setBusy(true); setError("");
    try { const result = await accountAction({ action: "send_delete_code" }); setSent(true); setDemo(result.demoCode || ""); setCode(""); setRemaining(60); }
    catch (error) { setError(error instanceof Error ? error.message : "发送失败"); }
    finally { setBusy(false); }
  }
  async function remove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !acknowledged) return;
    setBusy(true); setError("");
    try {
      await accountAction({ action: "delete_account", code, confirmation });
      try {
        for (const key of ["campus-personality-v2", "campus-personality-result-v1", "campus-login-email", "tongpin-plaza-draft-v2", `tongpin-onboarding-draft-v1:${userId}`]) localStorage.removeItem(key);
        for (const key of Object.keys(sessionStorage)) if (key.startsWith(`tongpin-chat-draft-v1:${userId}:`)) sessionStorage.removeItem(key);
      } catch { /* server deletion has already completed */ }
      window.location.replace("/?account=deleted");
    } catch (error) { setError(error instanceof Error ? error.message : "注销未完成，请重新获取验证码后重试。"); setBusy(false); }
  }
  return <main className="account-settings"><header><Link href="/" className="account-brand"><BrandMark /><strong>同频实验室</strong></Link><Link href="/community?tab=profile"><ArrowLeft size={16} />返回社区</Link></header><div className="account-layout"><div className="account-intro"><span className="account-eyebrow">留给自己，安心的边界</span><h1>账号与隐私</h1><p>你的信息、你的选择，始终由你掌握。</p></div><section className="account-card"><span className="account-card-icon"><ShieldCheck size={22} /></span><div><h2>{displayName}</h2><p>登录邮箱：<span>{email}</span></p><small>邮箱仅用于登录与账号安全验证，不会向其他用户公开。</small></div><Link href="/onboarding?return_to=%2Fcommunity%3Ftab%3Dprofile">资料与认证<ArrowUpRight size={15} /></Link></section><section className="account-delete-card"><div><span className="account-eyebrow">离开，也是一种选择</span><h2>注销账号</h2><p>注销后会移除个人资料、认证材料、头像、问卷与伙伴练习记录，删除本人发布的动态内容、评论、点赞和发送的私信，结束匹配并使所有设备退出登录。</p><p>操作无法恢复。举报、必要的匿名审计记录及历史备份按原有方式保留。重新注册会创建新账号，不会恢复旧资料。</p></div><Button variant="outline" onClick={() => { setError(""); setCode(""); setConfirmation(""); setAcknowledged(false); setOpen(true); }}><Trash2 size={15} />申请注销</Button></section><Link href="/community" className="account-return">继续逛逛同频<ArrowUpRight size={15} /></Link></div>
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}><DialogContent className="account-delete-dialog"><DialogHeader><DialogTitle>确认注销这个账号？</DialogTitle><DialogDescription>注销无法恢复。请验证你的登录邮箱，并确认已了解页面说明。</DialogDescription></DialogHeader><p className="account-email-destination"><Mail size={16} />验证码将发送到 {email}</p><Button type="button" variant="outline" onClick={send} disabled={busy || remaining > 0}>{remaining > 0 ? `${remaining} 秒后重发` : sent ? "重新发送注销验证码" : "获取注销验证码"}</Button>{sent && <p className="account-code-note" role="status">{demo ? `本地演示注销验证码：${demo}` : "注销验证码已发送，10 分钟内有效。"}</p>}{error && <p className="account-error" role="alert">{error}</p>}<form onSubmit={remove}><label htmlFor="account-delete-code">邮箱验证码</label><Input id="account-delete-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6 位注销验证码" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" /><label htmlFor="account-delete-confirmation">输入「注销账号」确认</label><Input id="account-delete-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" required placeholder="注销账号" /><label className="account-acknowledgement"><input type="checkbox" checked={acknowledged} onChange={event => setAcknowledged(event.target.checked)} required /><span>我已了解注销影响，确认注销当前账号。</span></label><div className="account-delete-actions"><Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>保留账号</Button><Button type="submit" disabled={busy || !sent || code.length !== 6 || confirmation !== "注销账号" || !acknowledged} className="account-confirm-delete">{busy && <Loader2 className="size-4 animate-spin" />}确认注销</Button></div></form></DialogContent></Dialog>
  </main>;
}
