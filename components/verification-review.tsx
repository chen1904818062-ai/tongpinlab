"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { verificationChecks, type StudentVerificationMethod } from "@/lib/student-verification";

type Evidence = { name: string; studentNumber: string; code: string; challenge: string; enrollmentUntil: string; images: string[]; university: string; method: StudentVerificationMethod; evidenceExpiresAt: string };
export function VerificationReview({ request, close, reviewed }: { request: { id: number; display_name: string; method: string; evidence_version: number }; close: () => void; reviewed: (id: number, status: "approved" | "rejected") => void }) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [error, setError] = useState("");
  const [checks, setChecks] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [maxUntil, setMaxUntil] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    if (!request.evidence_version) return;
    void fetch(`/api/admin/verification?id=${request.id}`, { cache: "no-store" }).then(async response => {
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      if (active) { setEvidence(result.data); setValidUntil(new Date(Math.min(Date.now() + 180 * 86400_000, new Date(result.data.enrollmentUntil + "T12:00:00Z").getTime())).toISOString().slice(0, 10)); setMaxUntil(new Date(Math.min(Date.now() + 183 * 86400_000, new Date(result.data.enrollmentUntil + "T12:00:00Z").getTime())).toISOString().slice(0, 10)); }
    }).catch(error => { if (active) setError(error instanceof Error ? error.message : "材料读取失败"); });
    return () => { active = false; };
  }, [request.id, request.evidence_version]);
  async function review(status: "approved" | "rejected") {
    setBusy(true);
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "review_verification", requestId: request.id, status, checks, note, validUntil }) });
      const result = await response.json(); if (!response.ok) throw Error(result.error);
      reviewed(request.id, status); toast.success(status === "approved" ? "在读身份已认证，原始材料已删除。" : "已退回，申请人可看到理由并重新提交。" ); close();
    } catch (error) { setError(error instanceof Error ? error.message : "审核失败"); }
    finally { setBusy(false); }
  }
  const required = verificationChecks[request.method as StudentVerificationMethod] || [];
  return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="verification-review max-h-[90dvh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>核验 {request.display_name} 的在读身份</DialogTitle><DialogDescription>仅管理员可查看。请实际核对材料后作出决定；勾选清单不会自动验证材料真伪。审核完成后删除原始材料，保留结果和审计记录。</DialogDescription></DialogHeader>
    {!request.evidence_version && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">旧版申请只有文字，无法核验。请写明理由后退回，让申请人补交新版材料。</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {evidence && <div className="space-y-5"><dl className="grid grid-cols-2 gap-3 rounded-xl bg-[#f2f6ee] p-4 text-sm"><div><dt className="text-slate-500">学校</dt><dd className="mt-1 break-words">{evidence.university}</dd></div><div><dt className="text-slate-500">凭证姓名</dt><dd className="mt-1">{evidence.name}</dd></div><div><dt className="text-slate-500">完整学号</dt><dd className="mt-1 break-all font-mono">{evidence.studentNumber}</dd></div><div><dt className="text-slate-500">预计毕业日期</dt><dd className="mt-1">{evidence.enrollmentUntil}</dd></div></dl>
      {evidence.method === "chsi_code" ? <div className="rounded-xl border p-4 text-sm leading-7"><p>报告在线验证码：<strong className="break-all font-mono">{evidence.code}</strong></p><a href="https://www.chsi.com.cn/xlcx/bgcx.jsp" target="_blank" rel="noopener noreferrer" className="text-[#286451] underline">打开学信网官方报告查验页 ↗</a><p className="mt-2 text-slate-500">在官网输入上方验证码，核对报告类型、有效期、学校、姓名、学号及当前学籍状态。不要仅凭截图或验证码格式通过。</p></div> : <div><p className="mb-3 break-words text-sm">本次手写口令：<strong className="font-mono">{evidence.challenge}</strong></p><div className="grid gap-4 sm:grid-cols-2">{evidence.images.map((image, index) => <figure key={index} className="rounded-xl border p-2"><Image unoptimized width={1600} height={1600} src={image} alt={index === 0 ? "学生证与本次手写口令" : "当期注册章或在读证明"} className="max-h-[420px] h-auto w-full object-contain" /><figcaption className="mt-2 text-xs text-slate-500">{index === 0 ? "资料页与口令" : "当前在读证明"}</figcaption></figure>)}</div></div>}
      <fieldset className="space-y-3 rounded-xl border p-4"><legend className="px-2 text-sm font-semibold">人工核验清单</legend>{required.map(item => <label key={item.id} className="flex items-start gap-3 text-sm leading-6"><input className="mt-1 size-4 shrink-0 accent-[#286451]" type="checkbox" checked={checks.includes(item.id)} onChange={event => setChecks(current => event.target.checked ? [...current, item.id] : current.filter(key => key !== item.id))} /><span>{item.text}</span></label>)}</fieldset>
      <label className="block text-sm font-medium">认证有效期至（最多 6 个月）<Input type="date" value={validUntil} max={maxUntil} onChange={event => setValidUntil(event.target.value)} className="mt-2" /></label></div>}
    <label className="block text-sm font-medium">核验结论 / 退回理由（会告知申请人）<Textarea className="mt-2" maxLength={300} value={note} onChange={event => setNote(event.target.value)} placeholder="例如：官网确认当前在读，信息一致；或请补拍本学期注册章。" /></label>
    <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={busy || note.trim().length < 4} onClick={() => review("rejected")}>退回补充材料</Button><Button className="bg-[#286451]" disabled={busy || !evidence || note.trim().length < 4 || !validUntil || required.some(item => !checks.includes(item.id))} onClick={() => review("approved")}>{busy ? "正在处理…" : "确认核验通过"}</Button></div>
  </DialogContent></Dialog>;
}
