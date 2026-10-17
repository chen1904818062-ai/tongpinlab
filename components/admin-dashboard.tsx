"use client";

import { BrandMark } from "@/components/brand-mark";
import { VerificationReview } from "@/components/verification-review";
import { verificationMethodLabel } from "@/lib/student-verification";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Activity, ArrowLeft, BadgeCheck, CheckCircle2, Clock3, FileCheck2, Heart, MessageCircle, Search, ShieldAlert, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type UserRow = { id: string; display_name: string; campus_email: string | null; campus_verified: number; verified_until: string | null; university: string | null; verification_method: string | null; verification_status: string; questionnaire_completed: number; matching_enabled: number; status: string; major: string | null; grade: string | null; review_status: string | null; created_at: string };
type VerificationRow = { id: number; user_id: string; display_name: string; method: string; university: string; identifier: string; note: string | null; status: string; created_at: string; evidence_version: number; review_note: string | null };
type ReportRow = { id: number; reporter_name: string; target_name: string; category: string; detail: string | null; status: string; admin_note: string | null; created_at: string };
type LogRow = { id: number; action: string; target_type: string; target_id: string; detail: string | null; created_at: string };
type AdminData = { counts: Record<string, number>; users: UserRow[]; verifications: VerificationRow[]; reports: ReportRow[]; logs: LogRow[] };

async function post(payload: Record<string, unknown>) {
  const response = await fetch("/api/admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as { ok: boolean; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "操作失败");
}

export function AdminDashboard({ initialData }: { initialData: unknown }) {
  const [data, setData] = useState(initialData as AdminData);
  const [query, setQuery] = useState("");
  const [selectedVerification, setSelectedVerification] = useState<VerificationRow | null>(null);
  const filteredUsers = useMemo(() => data.users.filter((user) => `${user.display_name}${user.campus_email || ""}${user.major || ""}`.toLowerCase().includes(query.toLowerCase())), [data.users, query]);

  async function reviewProfile(userId: string, reviewStatus: "approved" | "rejected") {
    try {
      await post({ action: "review_profile", userId, reviewStatus });
      setData((current) => ({ ...current, users: current.users.map((user) => user.id === userId ? { ...user, review_status: reviewStatus } : user) }));
      toast.success(reviewStatus === "approved" ? "资料审核已通过" : "资料已退回修改");
    } catch (error) { toast.error(error instanceof Error ? error.message : "操作失败"); }
  }

  async function resolveReport(reportId: number, status: "resolved" | "dismissed") {
    try {
      await post({ action: "resolve_report", reportId, status, note: status === "resolved" ? "已由管理员核实处理" : "未发现违规" });
      setData((current) => ({ ...current, reports: current.reports.map((report) => report.id === reportId ? { ...report, status } : report), counts: { ...current.counts, pending_reports: Math.max(0, Number(current.counts.pending_reports || 0) - 1) } }));
      toast.success(status === "resolved" ? "举报已处理" : "举报已驳回");
    } catch (error) { toast.error(error instanceof Error ? error.message : "操作失败"); }
  }

  function verificationReviewed(requestId: number, status: "approved" | "rejected") {
    const request = data.verifications.find(item => item.id === requestId);
    setData(current => ({ ...current, verifications: current.verifications.map(item => item.id === requestId ? { ...item, status } : item), users: current.users.map(user => user.id === request?.user_id ? { ...user, campus_verified: status === "approved" ? 1 : 0, verified_until: status === "approved" ? "just-reviewed" : null, verification_status: status } : user), counts: { ...current.counts, pending_verifications: Math.max(0, Number(current.counts.pending_verifications || 0) - 1) } }));
  }

  return (
    <main className="min-h-screen bg-[#f6f7f5] text-[#202b2b]">
      <header className="border-b border-[#202b2b] bg-[#202b2b] text-white">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-7"><div className="flex items-center gap-3"><BrandMark /><span><strong className="block text-sm">同频实验室</strong><small className="text-white/65">运营管理后台</small></span></div><Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white"><a href="/match" target="_top"><ArrowLeft className="mr-2 size-4" />返回用户端</a></Button></div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7">
        <div className="mb-7"><p className="text-sm text-slate-500">运营总览</p><h1 className="mt-1 text-2xl font-semibold">平台运行情况</h1></div>
        <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric icon={<Users />} label="注册用户" value={data.counts.users || 0} note="已排除演示账号" />
          <Metric icon={<BadgeCheck />} label="完成问卷" value={data.counts.completed || 0} note={`${data.counts.users ? Math.round((Number(data.counts.completed || 0) / Number(data.counts.users)) * 100) : 0}% 完成率`} />
          <Metric icon={<Heart />} label="匹配记录" value={data.counts.matches || 0} note="累计推荐" />
          <Metric icon={<MessageCircle />} label="私信数量" value={data.counts.messages || 0} note="累计消息" />
          <Metric icon={<ShieldAlert />} label="待处理举报" value={data.counts.pending_reports || 0} note="需要管理员关注" warning={Number(data.counts.pending_reports || 0) > 0} />
          <Metric icon={<FileCheck2 />} label="认证待审核" value={data.counts.pending_verifications || 0} note="学信网 / 学生证" warning={Number(data.counts.pending_verifications || 0) > 0} />
        </div>

        <Tabs defaultValue="users" className="rounded-[22px] border border-[#dce5ef] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[#e3eaf2] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="h-10 bg-[#edf3e9]"><TabsTrigger value="users">用户</TabsTrigger><TabsTrigger value="verifications">高校认证 <Badge variant="secondary" className="ml-2">{data.counts.pending_verifications || 0}</Badge></TabsTrigger><TabsTrigger value="reports">举报 <Badge variant="secondary" className="ml-2">{data.counts.pending_reports || 0}</Badge></TabsTrigger><TabsTrigger value="logs">日志</TabsTrigger></TabsList>
            <div className="relative w-full sm:w-72"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索姓名、邮箱或专业" className="pl-9" /></div>
          </div>

          <TabsContent value="users" className="m-0">
            <Table><TableHeader><TableRow><TableHead>用户</TableHead><TableHead>高校认证</TableHead><TableHead>匹配偏好</TableHead><TableHead>资料审核</TableHead><TableHead>匹配</TableHead><TableHead>注册时间</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{filteredUsers.map((user) => <TableRow key={user.id}><TableCell><strong className="block">{user.display_name}</strong><small className="text-slate-500">{user.grade || "—"} · {user.major || "专业待完善"}</small></TableCell><TableCell>{user.campus_verified ? <Status color={user.verified_until ? "green" : "amber"}>{user.verified_until ? verificationMethodLabel(user.verification_method) : "旧版认证"}</Status> : <Status color={user.verification_status === "pending" ? "amber" : "gray"}>{user.verification_status === "pending" ? "审核中" : "未认证"}</Status>}<small className="mt-1 block text-slate-400">{user.university || user.campus_email || "—"}</small></TableCell><TableCell>{user.questionnaire_completed ? "已完成" : "未完成"}</TableCell><TableCell><Status color={user.review_status === "approved" ? "green" : user.review_status === "rejected" ? "red" : "amber"}>{user.review_status === "approved" ? "已通过" : user.review_status === "rejected" ? "已退回" : "待审核"}</Status></TableCell><TableCell>{user.matching_enabled ? "已开启" : "已暂停"}</TableCell><TableCell>{formatDate(user.created_at)}</TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => reviewProfile(user.id, "approved")}>通过</Button><Button size="sm" variant="ghost" onClick={() => reviewProfile(user.id, "rejected")}>退回</Button></div></TableCell></TableRow>)}</TableBody></Table>
            {!filteredUsers.length && <Empty text="没有符合条件的用户" />}
          </TabsContent>

          <TabsContent value="verifications" className="m-0"><p className="border-b bg-[#f4f7ef] px-5 py-4 text-sm leading-6 text-[#60705d]">校园邮箱验证后自动通过；学信网和学生证查看关键材料后即可通过或退回，无需填写清单。已有认证保持有效。</p><Table><TableHeader><TableRow><TableHead>申请人</TableHead><TableHead>学校</TableHead><TableHead>方式</TableHead><TableHead>认证信息</TableHead><TableHead>状态</TableHead><TableHead>提交时间</TableHead><TableHead className="text-right">审核</TableHead></TableRow></TableHeader><TableBody>{data.verifications.map((item) => <TableRow key={item.id}><TableCell><strong>{item.display_name}</strong></TableCell><TableCell>{item.university}</TableCell><TableCell>{verificationMethodLabel(item.method)}</TableCell><TableCell className="max-w-xs whitespace-normal"><span className="font-mono text-xs">{item.identifier}</span>{item.note && <small className="mt-1 block text-slate-500">{item.note}</small>}</TableCell><TableCell><Status color={item.status === "approved" ? "green" : item.status === "rejected" ? "red" : "amber"}>{item.status === "approved" ? "已通过" : item.status === "rejected" ? "已退回" : item.status === "withdrawn" ? "已撤回" : "待审核"}</Status></TableCell><TableCell>{formatDate(item.created_at)}</TableCell><TableCell>{item.status === "pending" && <Button size="sm" onClick={() => setSelectedVerification(item)} className="bg-[#286451]">查看材料并审核</Button>}</TableCell></TableRow>)}</TableBody></Table>{!data.verifications.length && <Empty text="当前没有高校认证申请" />}</TabsContent>

          <TabsContent value="reports" className="m-0">
            <Table><TableHeader><TableRow><TableHead>编号</TableHead><TableHead>举报人与对象</TableHead><TableHead>原因</TableHead><TableHead>说明</TableHead><TableHead>状态</TableHead><TableHead>提交时间</TableHead><TableHead className="text-right">处理</TableHead></TableRow></TableHeader><TableBody>{data.reports.map((report) => <TableRow key={report.id}><TableCell>#{report.id}</TableCell><TableCell><strong>{report.reporter_name}</strong><span className="mx-1 text-slate-400">→</span>{report.target_name}</TableCell><TableCell>{report.category}</TableCell><TableCell className="max-w-xs whitespace-normal text-slate-600">{report.detail || "—"}</TableCell><TableCell><Status color={report.status === "pending" ? "amber" : report.status === "resolved" ? "green" : "gray"}>{report.status === "pending" ? "待处理" : report.status === "resolved" ? "已处理" : "已驳回"}</Status></TableCell><TableCell>{formatDate(report.created_at)}</TableCell><TableCell>{report.status === "pending" && <div className="flex justify-end gap-2"><Button size="sm" onClick={() => resolveReport(report.id, "resolved")} className="bg-[#0b1f3a]">标记处理</Button><Button size="sm" variant="outline" onClick={() => resolveReport(report.id, "dismissed")}>驳回</Button></div>}</TableCell></TableRow>)}</TableBody></Table>
            {!data.reports.length && <Empty text="当前没有举报记录" />}
          </TabsContent>

          <TabsContent value="logs" className="m-0 p-5"><div className="space-y-3">{data.logs.map((log) => <div key={log.id} className="flex items-start gap-4 rounded-xl border border-[#e3eaf2] p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#edf2f7] text-[#315474]"><Activity className="size-4" /></span><div className="flex-1"><strong className="text-sm">{log.action === "resolve_report" ? "处理举报" : log.action === "review_verification" ? "高校身份审核" : log.action === "view_verification_evidence" ? "查看认证材料" : "审核资料"}</strong><p className="mt-1 text-xs text-slate-500">{log.target_type} #{log.target_id} · {log.detail || "无备注"}</p></div><time className="text-xs text-slate-400">{formatDate(log.created_at)}</time></div>)}{!data.logs.length && <Empty text="暂无后台操作记录" />}</div></TabsContent>
        </Tabs>
      </div>
      {selectedVerification && <VerificationReview key={selectedVerification.id} request={selectedVerification} close={() => setSelectedVerification(null)} reviewed={verificationReviewed} />}
    </main>
  );
}

function Metric({ icon, label, value, note, warning = false }: { icon: React.ReactNode; label: string; value: number; note: string; warning?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-5 ${warning ? "border-[#f3c5be]" : "border-[#dce5ef]"}`}><div className="flex items-center justify-between"><span className={`grid size-10 place-items-center rounded-xl [&>svg]:size-5 ${warning ? "bg-[#fff0ee] text-[#d94c42]" : "bg-[#edf2f7] text-[#315474]"}`}>{icon}</span><span className="text-xs text-slate-400">实时</span></div><strong className="mt-4 block text-3xl">{value}</strong><span className="mt-1 block text-sm font-medium">{label}</span><small className="text-slate-400">{note}</small></div>;
}

function Status({ children, color }: { children: React.ReactNode; color: "green" | "gray" | "amber" | "red" }) {
  const colors = { green: "bg-emerald-50 text-emerald-700", gray: "bg-slate-100 text-slate-600", amber: "bg-amber-50 text-amber-700", red: "bg-red-50 text-red-700" };
  return <Badge className={`${colors[color]} border-0 font-medium`}>{color === "green" ? <CheckCircle2 className="mr-1 size-3" /> : color === "amber" ? <Clock3 className="mr-1 size-3" /> : null}{children}</Badge>;
}

function Empty({ text }: { text: string }) { return <div className="py-16 text-center text-sm text-slate-400">{text}</div>; }
function formatDate(value: string) { return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
