"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProfileAvatar } from "@/components/profile-avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { verificationMethodLabel } from "@/lib/student-verification";

type Detail = {
  user: { id: string; display_name: string; email: string | null; campus_email: string | null; university: string | null; verification_method: string | null; verification_status: string; verified_until: string | null };
  profile: { photoUrl: string | null; gender: string; grade: string; major: string; campus: string; hometown: string; height: number | null; smoking: string; lookingFor: string; bio: string; interests: string[]; personalityType: string | null; reviewStatus: string } | null;
};

export function ProfileReview({ userId, close, reviewed }: { userId: string; close: () => void; reviewed: (id: string, status: "approved" | "rejected") => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin?userId=" + encodeURIComponent(userId), { cache: "no-store", signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || "资料读取失败，请重试。");
      if (!controller.signal.aborted) setDetail(result.data);
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "资料读取失败，请重试。"); });
    return () => controller.abort();
  }, [userId, attempt]);

  async function review(status: "approved" | "rejected") {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "review_profile", userId, reviewStatus: status }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw Error(result.error || "审核失败");
      reviewed(userId, status); toast.success(status === "approved" ? "资料审核已通过" : "资料已退回修改"); close();
    } catch (error) { setError(error instanceof Error ? error.message : "审核失败"); }
    finally { setBusy(false); }
  }
  const profile = detail?.profile;
  return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>用户提交的资料</DialogTitle><DialogDescription>查看头像与个人资料后再审核。高校身份材料请在「高校认证」中核对。</DialogDescription></DialogHeader>
    {!detail && !error && <p role="status" className="py-8 text-center text-sm text-slate-500">正在读取用户资料…</p>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{!detail && <Button variant="outline" className="mt-3" onClick={() => { setError(""); setAttempt(value => value + 1); }}>重新加载资料</Button>}</div>}
    {detail && <div className="min-w-0 space-y-5"><div className="flex items-center gap-4 rounded-2xl bg-[#f2f6ee] p-4"><ProfileAvatar src={profile?.photoUrl} name={detail.user.display_name} className="size-20 text-3xl" /><div className="min-w-0"><h3 className="break-words text-lg font-semibold">{detail.user.display_name}</h3><p className="mt-1 text-sm text-slate-500">{profile?.personalityType || "未提交性格测评"}</p>{profile?.photoUrl && <a href={profile.photoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#286451] underline">查看头像原图 ↗</a>}</div></div>
      <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">{[
        ["登录邮箱", detail.user.email], ["校园邮箱", detail.user.campus_email], ["学校", detail.user.university], ["认证方式", detail.user.verification_method ? verificationMethodLabel(detail.user.verification_method) : "未认证"],
        ["性别", profile?.gender], ["年级", profile?.grade], ["专业", profile?.major], ["校区", profile?.campus], ["家乡", profile?.hometown], ["身高", profile?.height ? `${profile.height} cm` : null], ["吸烟情况", profile?.smoking], ["交友期待", profile?.lookingFor ? ({ "friends-first": "先从朋友开始", relationship: "稳定恋爱", open: "顺其自然" } as Record<string, string>)[profile.lookingFor] || profile.lookingFor : null],
      ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{value || "未填写"}</dd></div>)}</dl>
      <section><h3 className="text-sm font-medium">自我介绍</h3><p className="mt-2 whitespace-pre-wrap break-words rounded-xl border p-4 text-sm leading-7 [overflow-wrap:anywhere]">{profile?.bio || "未填写"}</p></section>
      <section><h3 className="text-sm font-medium">兴趣爱好</h3><div className="mt-2 flex flex-wrap gap-2">{profile?.interests.length ? profile.interests.map(interest => <span key={interest} className="rounded-full bg-[#edf3e6] px-3 py-1 text-sm">{interest}</span>) : <p className="text-sm text-slate-500">未填写</p>}</div></section>
      {!profile && <p className="text-sm text-amber-800">此账号尚未提交个人资料。</p>}
    </div>}
    <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={busy || !profile} onClick={() => void review("rejected")}>退回资料</Button><Button className="bg-[#286451]" disabled={busy || !profile} onClick={() => void review("approved")}>{busy ? "正在处理…" : "通过资料审核"}</Button></div>
  </DialogContent></Dialog>;
}
