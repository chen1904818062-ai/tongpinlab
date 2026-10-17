"use client";

import { useEffect, useState } from "react";
import { FileCheck2, GraduationCap, IdCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { StudentVerificationMethod, VerificationSummary } from "@/lib/student-verification";

type State = { latest: VerificationSummary | null; challenge: { text: string; token: string } };
export function StudentVerificationStep({ university = "", status }: { university?: string | null; status?: string }) {
  const [method, setMethod] = useState<StudentVerificationMethod>("chsi_code");
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  async function load() {
    const response = await fetch("/api/verification", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "认证状态读取失败");
    setState(result.data); setError("");
  }
  useEffect(() => { let active = true; void fetch("/api/verification", { cache: "no-store" }).then(async response => { const result = await response.json(); if (!response.ok) throw Error(result.error); if (active) setState(result.data); }).catch(() => { if (active) setError("认证服务暂时不可用，请刷新重试。"); }); return () => { active = false; }; }, []);
  async function withdraw() {
    setBusy(true);
    try { const response = await fetch("/api/verification", { method: "DELETE" }); const result = await response.json(); if (!response.ok) throw Error(result.error); await load(); toast.success("已撤回，材料已删除，可以重新提交。"); }
    catch (error) { setError(error instanceof Error ? error.message : "撤回失败"); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!state || busy) return;
    const form = event.currentTarget, body = new FormData(form);
    body.set("method", method); body.set("consent", String(consent)); body.set("challengeToken", state.challenge.token);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/verification", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "提交失败");
      form.reset(); setConsent(false); await load(); toast.success("材料已提交，管理员审核后才能参与互动。");
    } catch (error) { setError(error instanceof Error ? error.message : "提交失败，请稍后再试。"); }
    finally { setBusy(false); }
  }
  const latest = state?.latest, pending = latest?.status === "pending";
  return <section className="verification-step rounded-[26px] border border-[#e0e8dc] bg-white p-5 sm:p-9" aria-labelledby="student-verification-title">
    <p className="text-xs tracking-widest text-[#71806d]">第 1 步 · 高校身份</p>
    <h2 id="student-verification-title" className="mt-3 text-2xl font-semibold">核验当前在读身份</h2>
    <p className="mt-3 max-w-2xl text-sm leading-7 text-[#687568]">选一种方式提交本人材料。管理员会核对当前在读状态；审核期间可以继续逛广场，发言、匹配和聊天将在认证及其他准备完成后开放。</p>
    {status === "reverification_required" && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">认证规则已升级。此前的校园邮箱或文字认证需补交材料，原有资料、问卷和账号会保留，管理后台权限不受影响。</p>}
    {latest && <div className="verification-result mt-6 rounded-2xl border border-[#dce6d6] bg-[#f3f6ef] p-4 text-sm" role="status"><strong>{pending ? "认证申请审核中" : latest.status === "approved" ? "上次申请已通过" : latest.status === "withdrawn" ? "上次申请已撤回" : "认证申请需补充材料"}</strong><p className="mt-2 leading-6">{latest.review_note || (pending ? "审核不会自动通过。你可以刷新结果，或撤回后修改材料。" : "请按要求重新提交。")}</p>{pending && <div className="mt-3 flex flex-wrap gap-3"><Button variant="outline" type="button" onClick={() => window.location.reload()}>刷新审核结果</Button><Button variant="ghost" type="button" onClick={withdraw} disabled={busy}>撤回并删除材料</Button></div>}</div>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!pending && <form onSubmit={submit} className="mt-7 max-w-2xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">{[{ id: "chsi_code" as const, icon: GraduationCap, title: "学信网学籍报告", text: "提交在线验证码 · 推荐" }, { id: "student_card" as const, icon: IdCard, title: "学生证与注册证明", text: "带本次口令的照片 · 人工核验" }].map(item => <button type="button" key={item.id} aria-pressed={method === item.id} onClick={() => setMethod(item.id)} className={`rounded-2xl border p-4 text-left ${method === item.id ? "border-[#286451] bg-[#edf3e9] ring-2 ring-[#286451]/10" : "border-[#e0e5dd]"}`}><item.icon className="size-5 text-[#286451]" /><strong className="mt-3 block text-sm">{item.title}</strong><small className="mt-1 block text-[#6d786b]">{item.text}</small></button>)}</div>
      <div className="rounded-xl bg-[#f6f7f2] p-4 text-sm leading-7 text-[#60705d]">{method === "chsi_code" ? <><p>在学信网登录本人学信档案 → 在线验证报告 → 申请《教育部学籍在线验证报告》，提交报告下方的在线验证码。请保持报告在审核期内有效。</p><p className="mt-2">请提交学籍报告，学历/学位报告不能证明当前在读。<a href="https://www.chsi.com.cn/" target="_blank" rel="noopener noreferrer" className="ml-2 text-[#286451] underline">前往学信网官网 ↗</a></p></> : <><p>将学生证资料页与手写口令纸放在一起拍照，再拍摄本学期注册章或学校出具的在读证明。照片需能看清学校、姓名、完整学号和当期注册信息，无需露脸。</p><p className="my-3 break-words rounded-lg border border-[#c8d8bd] bg-white p-3 font-mono font-semibold text-[#286451]">本次手写口令：{state?.challenge.text || "正在生成…"}</p><p>口令 24 小时有效。拍照前遮挡身份证号、住址、电话及无关二维码；保留核验所需信息。每张 JPG / PNG / WebP 不超过 3MB。</p></>}</div>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="学校名称" id="verification-university"><Input id="verification-university" name="university" defaultValue={university || ""} required minLength={2} maxLength={80} placeholder="凭证上的完整学校名称" /></Field><Field label="凭证姓名" id="verification-name"><Input id="verification-name" name="name" required minLength={2} maxLength={60} autoComplete="off" placeholder="与报告或学生证一致" /></Field><Field label="完整学号" id="verification-student-number"><Input id="verification-student-number" name="studentNumber" required pattern="[A-Za-z0-9-]{4,40}" autoComplete="off" placeholder="用于核对并防止重复认证" /></Field><Field label="预计毕业日期" id="verification-enrollment-until"><Input id="verification-enrollment-until" name="enrollmentUntil" type="date" required /></Field></div>
      {method === "chsi_code" ? <Field label="学籍报告在线验证码（12 或 16 位）" id="verification-code"><Input id="verification-code" name="identifier" required pattern="(?:[A-Za-z0-9 ]{12,24})" autoComplete="off" placeholder="不是短信验证码，无需学信网账号密码" /></Field> : <div className="grid gap-4 sm:grid-cols-2"><Field label="学生证资料页与手写口令同框照片" id="verification-identity-photo"><Input className="h-auto py-3" id="verification-identity-photo" name="identityPhoto" type="file" accept="image/jpeg,image/png,image/webp" required /></Field><Field label="本学期注册章或在读证明照片" id="verification-enrollment-photo"><Input className="h-auto py-3" id="verification-enrollment-photo" name="enrollmentPhoto" type="file" accept="image/jpeg,image/png,image/webp" required /></Field></div>}
      <Field label="补充说明（可选）" id="verification-note"><Textarea id="verification-note" name="note" maxLength={300} placeholder="例如本学期注册信息所在位置，请勿填写身份证号。" /></Field>
      <label className="flex items-start gap-3 text-sm leading-6 text-[#5e6d5a]"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} className="mt-1 size-4 shrink-0 accent-[#286451]" required /><span>材料属于我本人，我同意仅为本账号学生身份核验使用。真实姓名、学号、报告码和照片仅管理员可查看，不向其他用户公开；材料加密保存，审核完成或撤回时删除，未审核材料 14 天后失效并在认证服务下次访问时清理。不采集身份证号或人脸。</span></label>
      <Button type="submit" disabled={busy || !state || !consent} className="rounded-full bg-[#286451] px-6 hover:bg-[#205340]">{busy ? <Loader2 className="size-4 animate-spin" /> : <FileCheck2 className="size-4" />}{busy ? "正在提交…" : "提交在读身份审核"}</Button>
    </form>}
    <div className="mt-7 flex gap-3 border-t border-[#e1e8dc] pt-5 text-xs leading-6 text-[#72816d]"><ShieldCheck className="mt-1 size-4 shrink-0" /><p>校园邮箱可能在毕业后仍能使用，仅可作为辅助凭据。认证采用人工核验，不能完全排除伪造或冒用；通过后最多有效 6 个月，到期需重新核验。</p></div>
  </section>;
}
function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div><label className="mb-2 block text-sm font-medium" htmlFor={id}>{label}</label>{children}</div>; }
