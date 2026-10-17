"use client";

import { BrandMark } from "@/components/brand-mark";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRight, BadgeCheck, BookOpen, BrainCircuit, Check, ChevronRight, Heart, Info, LockKeyhole, LogOut, MessageCircle, MoreHorizontal, Send, Settings2, ShieldCheck, Sparkles, UsersRound, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { CompanionGuide } from "@/components/companion-guide";
import { SocialPlaza } from "@/components/social-plaza";

type ProductData = {
  user: { id: string; displayName: string; campusVerified: boolean; questionnaireCompleted: boolean; matchingEnabled: boolean; role: string; university?: string | null; verificationMethod?: string | null; verificationStatus?: string } | null;
  profile: { major: string; grade: string; campus: string; bio: string; interests: string[]; reviewStatus: string; personalityType?: string | null; personalityScores?: Record<string, number> } | null;
  match: { id: number; status: string; ownIntent: string | null; otherIntent: string | null; mutual: boolean } | null;
  candidate: { id: string; name: string; university?: string; grade: string; major: string; campus: string; hometown: string; bio: string; interests: string[]; photoUrl: string | null; score: number; reasons: string[]; personalityType?: string | null; lookingFor?: string } | null;
  messages: { id: number; senderId: string; body: string; status: string; createdAt: string }[];
};

async function post<T>(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as { ok: boolean; data?: T; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "操作失败");
  return result.data as T;
}

async function get<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json() as { ok: boolean; data?: T; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "加载失败");
  return result.data as T;
}

export function ProductShell({ initialData, signOutPath }: { initialData: unknown; signOutPath: string }) {
  const [data, setData] = useState(initialData as ProductData);
  const [activeTab, setActiveTab] = useState("match");
  useEffect(() => {
    const tab = new URLSearchParams(location.search).get("tab");
    if (tab && ["match", "plaza", "chat", "profile"].includes(tab)) queueMicrotask(() => setActiveTab(tab));
  }, []);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState("不当言语");
  const [reportDetail, setReportDetail] = useState("");
  const candidate = data.candidate;
  const match = data.match;
  const lastMessageId = useRef(data.messages.at(-1)?.id ?? 0);
  const mutualRef = useRef(Boolean(match?.mutual));

  useEffect(() => {
    lastMessageId.current = Math.max(lastMessageId.current, data.messages.at(-1)?.id ?? 0);
    mutualRef.current = Boolean(match?.mutual);
  }, [data.messages, match?.mutual]);

  useEffect(() => {
    const matchId = match?.id;
    if (!matchId) return;
    let stopped = false;
    async function pollConversation() {
      try {
        const update = await get<{
          status: string; ownIntent: string | null; otherIntent: string | null; mutual: boolean;
          messages: ProductData["messages"];
        }>(`/api/messages?matchId=${matchId}&afterId=${lastMessageId.current}`);
        if (stopped) return;
        if (update.status === "passed") {
          const snapshot = await get<ProductData>("/api/matches");
          if (!stopped) {
            setData(snapshot);
            toast.info(snapshot.match ? "对方选择了略过，已为你更新推荐" : "这次没有配对成功，新的推荐正在准备中");
          }
          return;
        }
        const becameMutual = update.mutual && !mutualRef.current;
        mutualRef.current = update.mutual;
        setData((current) => {
          const merged = new Map(current.messages.map((item) => [item.id, item]));
          for (const item of update.messages) merged.set(item.id, item);
          const messages = [...merged.values()].sort((a, b) => a.id - b.id);
          lastMessageId.current = Math.max(lastMessageId.current, messages.at(-1)?.id ?? 0);
          return {
            ...current,
            match: current.match ? { ...current.match, status: update.status, ownIntent: update.ownIntent, otherIntent: update.otherIntent, mutual: update.mutual } : null,
            messages,
          };
        });
        if (becameMutual) toast.success("对方也选择了你，私信已解锁");
      } catch { /* transient polling failures are retried automatically */ }
    }
    void pollConversation();
    const timer = window.setInterval(() => void pollConversation(), 4000);
    return () => { stopped = true; window.clearInterval(timer); };
  }, [match?.id]);

  useEffect(() => {
    const modelContext = (navigator as Navigator & { modelContext?: { registerTool: (tool: unknown) => void } }).modelContext;
    if (!modelContext) return;
    modelContext.registerTool({
      name: "set_matching_enabled",
      description: "开启或暂停同频实验室的高校匹配推荐",
      inputSchema: { type: "object", properties: { enabled: { type: "boolean" } }, required: ["enabled"] },
      execute: async ({ enabled }: { enabled: boolean }) => post("/api/settings", { matchingEnabled: enabled }),
    });
    modelContext.registerTool({
      name: "send_private_message",
      description: "给当前匹配对象发送一条私信",
      inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] },
      execute: async ({ message: text }: { message: string }) => match ? post("/api/messages", { matchId: match.id, body: text }) : { error: "暂无匹配" },
    });
  }, [match]);

  useEffect(() => {
    const saved = window.localStorage.getItem("campus-personality-result-v1");
    if (!saved) return;
    try {
      const result = JSON.parse(saved) as { type?: string; scores?: Record<string, number>; traits?: Record<string, number> };
      const localScores = {
        ...(result.scores ?? {}),
        ...Object.fromEntries(Object.entries(result.traits ?? {}).map(([key, value]) => [`relationship_${key}`, value])),
      };
      const alreadySynced = result.type === data.profile?.personalityType
        && Object.entries(localScores).every(([key, value]) => data.profile?.personalityScores?.[key] === value);
      if (!result.type || alreadySynced) return;
      void post<{ personalityType: string; personalityScores: Record<string, number> }>("/api/personality", result).then((value) => {
        setData((current) => ({ ...current, profile: current.profile ? { ...current.profile, personalityType: value.personalityType, personalityScores: value.personalityScores } : current.profile }));
        toast.success("人格测试结果已同步到同频名片");
      }).catch(() => undefined);
    } catch { /* ignore invalid device-local result */ }
  }, [data.profile?.personalityType, data.profile?.personalityScores]);

  const firstName = useMemo(() => data.user?.displayName?.split(/[ ·]/)[0] || "同学", [data.user]);

  async function setIntent(intent: "interested" | "pass") {
    if (!match) return;
    try {
      const result = await post<{ intent: string; mutual: boolean; snapshot: ProductData | null }>("/api/matches", { matchId: match.id, intent });
      if (intent === "pass" && result.snapshot) {
        setData(result.snapshot);
        toast.success(result.snapshot.match ? "已跳过，下一位同频对象已准备好" : "已跳过，暂无新的可推荐用户");
        return;
      }
      setData((current) => ({ ...current, match: current.match ? { ...current.match, ownIntent: result.intent, mutual: result.mutual } : null }));
      if (result.mutual) {
        toast.success("匹配成功！私信已解锁");
        setActiveTab("chat");
      } else {
        toast.success(intent === "interested" ? "已表达心意，对方同意后即可继续了解" : "已跳过，本次推荐不会再次出现");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "操作失败");
    }
  }

  async function toggleMatching(enabled: boolean) {
    setData((current) => ({ ...current, user: current.user ? { ...current.user, matchingEnabled: enabled } : null }));
    try {
      await post("/api/settings", { matchingEnabled: enabled });
      toast.success(enabled ? "匹配推荐已开启" : "匹配推荐已暂停");
    } catch (error) {
      setData((current) => ({ ...current, user: current.user ? { ...current.user, matchingEnabled: !enabled } : null }));
      toast.error(error instanceof Error ? error.message : "设置失败");
    }
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    if (!match || !message.trim() || sending) return;
    setSending(true);
    try {
      const item = await post<ProductData["messages"][number]>("/api/messages", { matchId: match.id, body: message });
      lastMessageId.current = Math.max(lastMessageId.current, item.id);
      setData((current) => ({ ...current, messages: current.messages.some((messageItem) => messageItem.id === item.id) ? current.messages : [...current.messages, item] }));
      setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败");
    } finally {
      setSending(false);
    }
  }

  async function submitReport() {
    if (!candidate) return;
    try {
      await post("/api/reports", { targetUserId: candidate.id, category: reportCategory, detail: reportDetail });
      setReportOpen(false);
      setReportDetail("");
      toast.success("举报已提交，管理员会尽快处理");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败");
    }
  }

  return (
    <main className="premium-product min-h-screen overflow-x-hidden bg-[#f6f7f5] text-[#202b2b]">
      <header className="sticky top-0 z-30 border-b border-[#e3e9e3] bg-[#f6f7f5]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" target="_top" className="flex items-center gap-3">
            <BrandMark />
            <span><strong className="block text-[15px] tracking-wide">同频实验室</strong><small className="hidden text-[11px] text-slate-500 sm:block">全国高校人格与关系社区</small></span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/community">逛广场</Link></Button>
            {data.user?.role === "admin" && <Button asChild variant="ghost" size="sm"><a href="/admin" target="_top">管理后台</a></Button>}
            <Button asChild variant="ghost" size="icon" aria-label="退出登录"><a href={signOutPath} target="_top"><LogOut className="size-4" /></a></Button>
            <div className="grid size-9 place-items-center rounded-full bg-[#e8eef7] text-sm font-semibold text-[#0b1f3a]">{firstName.slice(0, 1)}</div>
          </div>
        </div>
      </header>

      {!data.user?.questionnaireCompleted && (
        <div className="border-b border-[#ffd8d4] bg-[#fff3f1]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex items-center gap-2"><Sparkles className="size-4 text-[#286451]" />完成 20 题相处偏好后，才能进入真实学生推荐池。</p>
            <Button asChild size="sm" className="bg-[#286451] text-white hover:bg-[#205340]"><a href="/onboarding" target="_top">继续填写 <ArrowRight className="ml-1 size-4" /></a></Button>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="mb-1 text-sm font-semibold text-[#286451]">你好，{firstName} · {data.profile?.personalityType || "性格结果待同步"}</p><h1 className="font-sans text-2xl font-semibold tracking-tight sm:text-3xl">从一件小事，遇见聊得来的同学</h1></div>
          <div className="flex items-center gap-3 rounded-2xl border border-[#dfe7f1] bg-white px-4 py-3 shadow-sm"><span><strong className="block text-sm">接受每日推荐</strong><small className="text-slate-500">关闭后不会生成新匹配</small></span><Switch checked={Boolean(data.user?.matchingEnabled)} onCheckedChange={toggleMatching} /></div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0 max-w-full">
          <TabsList className="mb-6 flex h-auto w-full max-w-full justify-start gap-1 overflow-x-auto rounded-full border border-[#e3e9e3] bg-white p-1 sm:w-auto">
            <TabsTrigger value="match" className="shrink-0 gap-2 px-5"><Heart className="size-4" />今日同频</TabsTrigger>
            <TabsTrigger value="plaza" className="shrink-0 gap-2 px-5"><UsersRound className="size-4" />同频广场</TabsTrigger>
            <TabsTrigger value="chat" className="shrink-0 gap-2 px-5"><MessageCircle className="size-4" />私信</TabsTrigger>
            <TabsTrigger value="profile" className="shrink-0 gap-2 px-5"><UserRound className="size-4" />我的资料</TabsTrigger>
          </TabsList>

          <TabsContent value="match" className="mt-0">
            {candidate && match ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
                <section className="overflow-hidden rounded-[28px] border border-[#e3e9e3] bg-white shadow-[0_18px_50px_rgba(23,36,31,.08)]">
                  <div className="grid min-h-[540px] md:grid-cols-[46%_54%]">
                    <div className="relative min-h-[360px] overflow-hidden bg-[#dbe6df]">
                      {candidate.photoUrl ? <Image src={candidate.photoUrl} alt={`${candidate.name}上传的个人照片`} fill priority sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" /> : <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#dfe8e2,#cbd9d1)]"><div className="text-center text-[#416054]"><span className="mx-auto grid size-24 place-items-center rounded-full border border-white/70 bg-white/55 text-4xl font-semibold">{candidate.name.slice(0, 1)}</span><p className="mt-4 text-sm">对方暂未上传照片</p></div></div>}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#071426]/85 to-transparent p-6 pt-24 text-white">
                        <div className="mb-3 flex flex-wrap gap-2"><Badge className="border-white/20 bg-white/15 text-white">高校身份已认证</Badge><Badge className="border-white/20 bg-white/90 text-[#202b2b]">{candidate.personalityType || "ENFP"} · MBTI 倾向</Badge></div>
                        <h2 className="text-3xl font-semibold">{candidate.name}</h2>
                        <p className="mt-1 text-sm text-white/80">{candidate.university} · {candidate.grade} · {candidate.major}</p>
                      </div>
                    </div>
                    <div className="flex flex-col p-6 sm:p-8">
                      <div className="flex items-center justify-between">
                        <div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#286451]">综合相处契合度</p><div className="mt-1 flex items-baseline gap-2"><strong className="text-5xl font-semibold text-[#286451]">{candidate.score}</strong><span className="text-slate-500">/ 100</span></div></div>
                        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
                          <DialogTrigger asChild><Button variant="ghost" size="icon" aria-label="更多操作"><MoreHorizontal /></Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>举报此用户</DialogTitle><DialogDescription>你的身份不会向对方公开，管理员会审查提交内容。</DialogDescription></DialogHeader>
                            <label className="text-sm font-medium">举报原因</label>
                            <select value={reportCategory} onChange={(e) => setReportCategory(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option>不当言语</option><option>虚假信息</option><option>骚扰行为</option><option>疑似诈骗</option><option>其他</option></select>
                            <label className="text-sm font-medium">补充说明</label><Textarea value={reportDetail} onChange={(e) => setReportDetail(e.target.value)} placeholder="请描述具体情况" />
                            <Button onClick={submitReport} className="bg-[#0b1f3a]">提交举报</Button>
                          </DialogContent>
                        </Dialog>
                      </div>
                      <p className="mt-6 leading-7 text-slate-600">{candidate.bio}</p>
                      <div className="mt-5 flex flex-wrap gap-2">{candidate.interests.map((item) => <Badge key={item} variant="secondary" className="rounded-full bg-[#edf3f9] px-3 py-1 text-[#254366]">{item}</Badge>)}</div>
                      <div className="mt-7 border-t border-[#e2e3de] pt-6"><h3 className="mb-4 flex items-center gap-2 font-semibold"><Sparkles className="size-4 text-[#286451]" />为什么你们可能同频</h3><ul className="space-y-3">{candidate.reasons.map((item) => <li key={item} className="flex gap-3 text-sm text-slate-600"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#edf2ee] text-[#286451]"><Check className="size-3" /></span>{item}</li>)}</ul><p className="mt-4 rounded-xl bg-[#f1eee6] p-3 text-xs leading-5 text-[#665746]">性格只是开启对话的线索，不是对一个人的最终结论。</p></div>
                      <div className="mt-auto grid grid-cols-2 gap-3 pt-8"><Button variant="outline" size="lg" onClick={() => setIntent("pass")} disabled={match.mutual}>这次先略过</Button><Button size="lg" onClick={() => match.mutual ? setActiveTab("chat") : setIntent("interested")} className="bg-[#286451] hover:bg-[#205340]"><Heart className="mr-2 size-4" />{match.mutual ? "进入私信" : match.ownIntent === "interested" ? "已发出同频信号" : "想认识对方"}</Button></div>
                    </div>
                  </div>
                </section>

                <aside className="space-y-5">
                  <div className="rounded-[24px] bg-[#202b2b] p-6 text-white"><div className="mb-5 flex items-center justify-between"><span className="grid size-11 place-items-center rounded-full bg-white/10"><LockKeyhole className="size-5 text-white" /></span><Badge className="bg-white/15 text-white">双向保护</Badge></div><h3 className="text-lg font-semibold">互相选择后再联系</h3><p className="mt-2 text-sm leading-6 text-white/75">双方都发出同频信号后私信才会开启。高校邮箱、学号和真实联系方式始终隐藏。</p></div>
                  <div className="rounded-[24px] border border-[#dfe2ec] bg-white p-6"><h3 className="mb-4 font-semibold">今日推荐概览</h3><div className="space-y-4 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-slate-500">学校</span><strong className="text-right">{candidate.university}</strong></div><div className="flex items-center justify-between gap-4"><span className="text-slate-500">校区</span><strong className="text-right">{candidate.campus || "未填写"}</strong></div><div className="flex items-center justify-between gap-4"><span className="text-slate-500">来自</span><strong className="text-right">{candidate.hometown || "未填写"}</strong></div><div className="flex items-center justify-between gap-4"><span className="text-slate-500">关系期待</span><strong className="text-right">{lookingForText(candidate.lookingFor)}</strong></div></div><Dialog><DialogTrigger asChild><Button variant="outline" className="mt-5 w-full">查看匹配说明 <Info className="ml-2 size-4" /></Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{candidate.score}% 契合度如何得出？</DialogTitle><DialogDescription>系统比较 MBTI 倾向，再结合相处偏好、兴趣和关系期待。分数只用于帮助开启对话，不代表关系质量保证。</DialogDescription></DialogHeader></DialogContent></Dialog></div>
                </aside>
              </div>
            ) : <EmptyState />}
          </TabsContent>

          <TabsContent value="plaza" className="mt-0"><CompanionGuide personalityType={data.profile?.personalityType || ""} />
            <SocialPlaza currentUserId={data.user?.id || ""} />
          </TabsContent>

          <TabsContent value="chat" className="mt-0">
            {!match?.mutual ? (
              <section className="mx-auto max-w-3xl rounded-[28px] border border-[#dfe7f1] bg-white px-6 py-20 text-center shadow-sm">
                <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e8eef7] text-[#294767]"><LockKeyhole className="size-7" /></span>
                <h2 className="mt-5 text-2xl font-semibold">私信将在双向选择后解锁</h2>
                <p className="mx-auto mt-3 max-w-lg leading-7 text-slate-500">先回到今日匹配表达心意。只有对方也选择“想认识”，双方才可以发送消息。</p>
                <Button className="mt-6 bg-[#286451] hover:bg-[#205340]" onClick={() => setActiveTab("match")}>返回今日匹配 <ArrowRight className="ml-2 size-4" /></Button>
              </section>
            ) : <section className="mx-auto grid min-h-[650px] max-w-5xl overflow-hidden rounded-[24px] border border-[#dfe7f1] bg-white shadow-sm md:grid-cols-[280px_1fr]">
              <aside className="border-b border-[#e3eaf2] bg-[#f8fafc] p-4 md:border-b-0 md:border-r"><h2 className="px-2 py-3 text-lg font-semibold">私信</h2>{candidate && <button className="flex w-full items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm">{candidate.photoUrl ? <Image src={candidate.photoUrl} alt="" width={48} height={48} className="size-12 rounded-full object-cover" /> : <span className="grid size-12 shrink-0 place-items-center rounded-full bg-[#dfe8e2] font-semibold text-[#416054]">{candidate.name.slice(0, 1)}</span>}<span className="min-w-0 flex-1"><strong className="block">{candidate.name}</strong><small className="block truncate text-slate-500">{data.messages.at(-1)?.body || "匹配成功，可以开始聊天"}</small></span><span className="size-2 rounded-full bg-[#3ba878]" /></button>}</aside>
              <div className="flex min-h-[520px] flex-col">
                <div className="flex items-center gap-3 border-b border-[#e3eaf2] px-5 py-4"><BadgeCheck className="size-5 text-[#2f8a69]" /><div><strong>{candidate?.name || "暂无会话"}</strong><p className="text-xs text-slate-500">校园身份已认证 · 请注意保护个人隐私</p></div></div>
                <div className="flex-1 space-y-4 overflow-y-auto bg-[#fbfcfe] p-5">{data.messages.map((item) => { const mine = item.senderId === data.user?.id; return <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}><div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 ${mine ? "rounded-br-md bg-[#0b1f3a] text-white" : "rounded-bl-md border border-[#e1e8f0] bg-white text-slate-700"}`}>{item.body}<time className={`mt-1 block text-[11px] ${mine ? "text-white/55" : "text-slate-400"}`}>{new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></div></div>; })}</div>
                <form onSubmit={sendMessage} className="flex gap-3 border-t border-[#e3eaf2] p-4"><Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="说点真诚、轻松的话…" maxLength={500} /><Button disabled={sending || !message.trim()} type="submit" className="bg-[#286451] hover:bg-[#205340]"><Send className="mr-2 size-4" />发送</Button></form>
              </div>
            </section>}
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
              <section className="rounded-[24px] border border-[#e3e9e3] bg-white p-6 shadow-[0_14px_40px_rgba(23,36,31,.06)] sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><div className="grid size-20 place-items-center rounded-full bg-[#edf2ee] text-3xl font-semibold text-[#286451]">{firstName.slice(0, 1)}</div><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold">{data.user?.displayName}</h2>{data.user?.campusVerified && <Badge className="bg-[#e4f5ed] text-[#1f7653]"><BadgeCheck className="mr-1 size-3" />高校认证</Badge>}</div><p className="mt-1 text-slate-500">{data.user?.university || "学校待完善"} · {data.profile?.grade || "年级待完善"} · {data.profile?.major || "专业待完善"}</p></div><Button asChild variant="outline"><a href="/onboarding" target="_top"><Settings2 className="mr-2 size-4" />编辑资料与偏好</a></Button></div><div className="mt-8 grid gap-4 border-t border-[#e3e4eb] pt-6 sm:grid-cols-4"><Stat label="MBTI 倾向" value={data.profile?.personalityType || "待测试"} /><Stat label="资料审核" value={data.profile?.reviewStatus === "approved" ? "已通过" : "待审核"} /><Stat label="相处偏好" value={data.user?.questionnaireCompleted ? "20 / 20" : "未完成"} /><Stat label="匹配状态" value={data.user?.matchingEnabled ? "进行中" : "已暂停"} /></div><div className="mt-7"><h3 className="font-semibold">关于我</h3><p className="mt-2 leading-7 text-slate-600">{data.profile?.bio || "补充一段真实的自我介绍，让推荐对象更好地认识你。"}</p></div></section>
              <aside className="space-y-4"><Link href="/" target="_top" className="flex items-center gap-4 rounded-2xl border border-[#e3e9e3] bg-white p-5 transition hover:border-[#286451]"><span className="grid size-10 place-items-center rounded-full bg-[#edf2ee] text-[#286451]"><BrainCircuit className="size-5" /></span><span className="flex-1"><strong className="block">MBTI × 关系性格</strong><small className="text-slate-500">重测后自动同步完整结果</small></span><ChevronRight className="size-5 text-slate-400" /></Link><a href="/onboarding" target="_top" className="flex items-center gap-4 rounded-2xl border border-[#e3e9e3] bg-white p-5 transition hover:border-[#286451]"><span className="grid size-10 place-items-center rounded-full bg-[#edf0ed] text-[#725b46]"><BookOpen className="size-5" /></span><span className="flex-1"><strong className="block">相处偏好</strong><small className="text-slate-500">查看与更新 5 组、20 题匹配信息</small></span><ChevronRight className="size-5 text-slate-400" /></a><div className="rounded-2xl border border-[#e3e9e3] bg-white p-5"><ShieldCheck className="mb-3 size-6 text-[#2f8a69]" /><h3 className="font-semibold">安全中心</h3><p className="mt-2 text-sm leading-6 text-slate-500">平台不会公开高校邮箱或学号。遇到不适内容，请及时举报或停止联系。</p></div></aside>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-[#f6f8fb] p-4"><span className="text-xs text-slate-500">{label}</span><strong className="mt-1 block">{value}</strong></div>;
}

function EmptyState() {
  return <div className="rounded-[24px] border border-dashed border-[#c8d4e2] bg-white px-6 py-20 text-center"><Heart className="mx-auto size-10 text-[#286451]" /><h2 className="mt-4 text-xl font-semibold">暂时没有合适的新推荐</h2><p className="mx-auto mt-2 max-w-lg text-slate-500">保持推荐开启即可。只有完成高校认证、资料和匹配偏好的真实用户会进入推荐池。</p></div>;
}

function lookingForText(value?: string) {
  if (value === "friends-first") return "先从朋友开始";
  if (value === "open") return "顺其自然";
  return "认真稳定的关系";
}
