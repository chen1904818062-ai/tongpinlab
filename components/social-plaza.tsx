"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Compass, Flag, Heart, Loader2, MessageCircle, PenLine, Send, Sparkles, Trash2, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PlazaComment = { id: number; authorId: string; authorName: string; personalityType: string; body: string; createdAt: string };
type PlazaPost = { id: number; authorId: string; authorName: string; university: string; personalityType: string; category: string; audience: string; content: string; likeCount: number; commentCount: number; viewerLiked: boolean; createdAt: string; comments: PlazaComment[] };
type PlazaSnapshot = { viewer: { university: string; personalityType: string }; posts: PlazaPost[] };

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const result = await response.json() as { ok: boolean; data?: T; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "操作失败");
  return result.data as T;
}

async function action<T>(payload: Record<string, unknown>) {
  return request<T>("/api/plaza", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
}

const categories = ["校园瞬间", "寻找同伴", "情绪树洞", "观点交换"];
const dailyPrompts = [
  "大学里哪件小事，让你觉得自己被理解了？",
  "如果今晚不用赶作业，你最想约人去哪里走走？",
  "你们学校有什么只有本校生才懂的暗号？",
  "最近哪一顿饭，意外治愈了你？",
  "哪门课改变过你看待一件事的方式？",
  "你最想找到哪一种不必硬聊的校园搭子？",
  "分享一个让普通一天变得很好笑的瞬间。",
  "如果给大一的自己一句话，你会说什么？",
  "校园里哪个角落最适合一个人放空？",
  "你最近学会拒绝的一件事是什么？",
  "什么爱好让你在陌生人面前也能很快打开话题？",
  "你心中最靠谱的朋友，会做哪一件小事？",
  "期末周结束后的第一件事，你想留给谁？",
  "如果周末只能选一项：散步、运动、看展还是探店？",
];
const todaysPrompt = dailyPrompts[Math.floor(Date.now() / 86_400_000) % dailyPrompts.length];
const filters = [
  { id: "all", label: "全国广场" },
  { id: "school", label: "同校动态" },
  { id: "personality", label: "同人格" },
];

export function SocialPlaza({ currentUserId }: { currentUserId: string }) {
  const [data, setData] = useState<PlazaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState(categories[0]);
  const [audience, setAudience] = useState("national");
  const [content, setContent] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [commentingPost, setCommentingPost] = useState<number | null>(null);

  const loadPlaza = useCallback(async () => {
    try { setData(await request<PlazaSnapshot>("/api/plaza")); }
    catch (error) { toast.error(error instanceof Error ? error.message : "广场加载失败"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    async function refresh(showError: boolean) {
      try {
        const snapshot = await request<PlazaSnapshot>("/api/plaza");
        if (active) setData(snapshot);
      } catch (error) {
        if (active && showError) toast.error(error instanceof Error ? error.message : "广场加载失败");
      } finally {
        if (active) setLoading(false);
      }
    }
    void refresh(true);
    const timer = window.setInterval(() => void refresh(false), 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const visiblePosts = useMemo(() => {
    if (!data) return [];
    if (filter === "school") return data.posts.filter((post) => post.university === data.viewer.university);
    if (filter === "personality") return data.posts.filter((post) => post.personalityType === data.viewer.personalityType);
    return data.posts;
  }, [data, filter]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (content.trim().length < 5 || busy) return;
    setBusy(true);
    try {
      await action({ action: "create_post", category, audience, content });
      setContent("");
      toast.success("已发布到同频广场");
      await loadPlaza();
    } catch (error) { toast.error(error instanceof Error ? error.message : "发布失败"); }
    finally { setBusy(false); }
  }

  async function toggleLike(postId: number) {
    if (!data) return;
    const before = data;
    setData({ ...data, posts: data.posts.map((post) => post.id === postId ? { ...post, viewerLiked: !post.viewerLiked, likeCount: Math.max(0, post.likeCount + (post.viewerLiked ? -1 : 1)) } : post) });
    try {
      const result = await action<{ postId: number; liked: boolean; likeCount: number }>({ action: "toggle_like", postId });
      setData((current) => current ? { ...current, posts: current.posts.map((post) => post.id === postId ? { ...post, viewerLiked: result.liked, likeCount: result.likeCount } : post) } : current);
    } catch (error) { setData(before); toast.error(error instanceof Error ? error.message : "点赞失败"); }
  }

  async function addComment(event: FormEvent, postId: number) {
    event.preventDefault();
    const body = commentDrafts[postId]?.trim() || "";
    if (body.length < 2) return;
    try {
      const comment = await action<PlazaComment>({ action: "add_comment", postId, body });
      setData((current) => current ? { ...current, posts: current.posts.map((post) => post.id === postId ? { ...post, comments: [...post.comments, comment].slice(-3), commentCount: post.commentCount + 1 } : post) } : current);
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      toast.success("评论已发送");
    } catch (error) { toast.error(error instanceof Error ? error.message : "评论失败"); }
  }

  async function report(post: PlazaPost) {
    if (!window.confirm("确认举报这条广场动态吗？管理员会进行审核。")) return;
    try {
      await request("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetUserId: post.authorId, category: "广场内容", detail: `动态 #${post.id}：${post.content.slice(0, 120)}` }) });
      toast.success("举报已提交");
    } catch (error) { toast.error(error instanceof Error ? error.message : "举报失败"); }
  }

  async function deletePost(post: PlazaPost) {
    if (!window.confirm("确认删除这条动态吗？删除后其他用户将无法看到。")) return;
    try {
      await action({ action: "delete_post", postId: post.id });
      setData((current) => current ? { ...current, posts: current.posts.filter((item) => item.id !== post.id) } : current);
      toast.success("动态已删除");
    } catch (error) { toast.error(error instanceof Error ? error.message : "删除失败"); }
  }

  if (loading) return <div className="grid min-h-[420px] place-items-center rounded-[28px] border border-[#e5e5e7] bg-white"><div className="text-center"><Loader2 className="mx-auto size-7 animate-spin text-[#286451]" /><p className="mt-3 text-sm text-[#6e6e73]">正在打开同频广场…</p></div></div>;

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
    <div className="min-w-0 space-y-5">
      <section className="min-w-0 overflow-hidden rounded-[28px] border border-[#e5e5e7] bg-[#eef2ef] p-5 sm:p-7">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><p className="flex items-center gap-2 text-sm font-semibold text-[#286451]"><Sparkles className="size-4" />今日破冰问题</p><h2 className="mt-2 break-words font-sans text-xl font-semibold sm:text-2xl">{todaysPrompt}</h2></div><Badge className="w-fit max-w-full bg-[#1d1d1f] text-white">每天 0 点更新</Badge></div>
      </section>

      <section className="rounded-[26px] border border-[#dfe2ec] bg-white p-5 sm:p-6">
        <form onSubmit={publish}><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-[#edf2ee] text-[#286451]"><PenLine className="size-5" /></span><div><h2 className="font-semibold">说点此刻真实的</h2><p className="text-sm text-[#6e6e73]">认证高校学生可见，请尊重边界，不公开联系方式。</p></div></div><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="分享校园瞬间、寻找活动搭子，或回答今天的破冰问题…" maxLength={500} className="mt-5 min-h-28 resize-none rounded-2xl border-[#e5e5e7] text-base" /><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2"><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="动态分类" className="h-10 rounded-xl border border-[#d6d6da] bg-white px-3 text-sm font-medium">{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={audience} onChange={(event) => setAudience(event.target.value)} aria-label="可见范围" className="h-10 rounded-xl border border-[#d6d6da] bg-white px-3 text-sm font-medium"><option value="national">全国高校可见</option><option value="same_university">仅同校可见</option></select></div><div className="flex items-center justify-between gap-3"><span className="text-xs text-[#8a91a3]">{content.length} / 500</span><Button type="submit" disabled={busy || content.trim().length < 5} className="rounded-full bg-[#286451] px-5 font-medium hover:bg-[#205340]">{busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}发布</Button></div></div></form>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">{filters.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${filter === item.id ? "bg-[#1d1d1f] text-white" : "border border-[#e5e5e7] bg-white text-[#737379] hover:border-[#286451]"}`}>{item.label}</button>)}</div>

      {visiblePosts.map((post) => <article key={post.id} className="rounded-[26px] border border-[#dfe2ec] bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#edf2ee] text-lg font-semibold text-[#286451]">{post.authorName.slice(0, 1)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{post.authorName}</strong><BadgeCheck className="size-4 text-[#2f8a69]" /><Badge variant="secondary" className="bg-[#edf0ed] text-[#725b46]">{post.personalityType}</Badge></div><p className="mt-0.5 truncate text-sm text-[#6e6e73]">{post.university} · {formatRelative(post.createdAt)} · {post.audience === "same_university" ? "仅同校" : "全国"}</p></div>{post.authorId === currentUserId ? <button type="button" onClick={() => void deletePost(post)} className="rounded-lg p-2 text-[#9aa1b2] hover:bg-[#f2f3f7] hover:text-[#d94c42]" aria-label="删除动态"><Trash2 className="size-4" /></button> : <button type="button" onClick={() => void report(post)} className="rounded-lg p-2 text-[#9aa1b2] hover:bg-[#f2f3f7] hover:text-[#d94c42]" aria-label="举报动态"><Flag className="size-4" /></button>}</div>
        <Badge variant="outline" className="mt-5 rounded-full">{post.category}</Badge><p className="mt-3 whitespace-pre-wrap text-base leading-8 text-[#333c53]">{post.content}</p>
        <div className="mt-5 flex items-center gap-2 border-t border-[#eceef3] pt-4"><Button type="button" variant="ghost" size="sm" onClick={() => void toggleLike(post.id)} className={post.viewerLiked ? "text-[#e2526c]" : "text-[#697188]"}><Heart className={`mr-2 size-4 ${post.viewerLiked ? "fill-current" : ""}`} />{post.likeCount || "赞"}</Button><Button type="button" variant="ghost" size="sm" onClick={() => setCommentingPost(commentingPost === post.id ? null : post.id)} className="text-[#697188]"><MessageCircle className="mr-2 size-4" />{post.commentCount || "评论"}</Button></div>
        {post.comments.length > 0 && <div className="mt-3 space-y-2 rounded-2xl bg-[#f5f5f7] p-4">{post.comments.map((comment) => <p key={comment.id} className="text-sm leading-6"><strong className="mr-2 text-[#286451]">{comment.authorName} · {comment.personalityType}</strong><span className="text-[#636369]">{comment.body}</span></p>)}</div>}
        {commentingPost === post.id && <form onSubmit={(event) => void addComment(event, post.id)} className="mt-3 flex gap-2"><Input value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={160} placeholder="友善评论，聊聊你的感受…" className="rounded-xl" /><Button type="submit" size="icon" disabled={(commentDrafts[post.id]?.trim().length || 0) < 2} className="shrink-0 rounded-full bg-[#286451]" aria-label="发送评论"><Send className="size-4" /></Button></form>}
      </article>)}

      {!visiblePosts.length && <div className="rounded-[24px] border border-dashed border-[#cbd0c8] bg-white px-6 py-16 text-center"><UsersRound className="mx-auto size-9 text-[#286451]" /><h3 className="mt-4 text-lg font-semibold">这里还在等第一句话</h3><p className="mt-2 text-sm text-[#6e6e73]">换个筛选条件，或者发布第一条动态。</p></div>}
    </div>

    <aside className="h-fit space-y-4 lg:sticky lg:top-24"><div className="rounded-[24px] bg-[#284a3b] p-6 text-white"><Compass className="size-7 text-white/80" /><h2 className="mt-4 font-sans text-xl font-semibold">性格不是圈层，是破冰线索</h2><p className="mt-2 text-sm leading-6 text-white/75">同类型的人可能很不同，不同类型的人也可能很合拍。先从具体经历开始认识。</p></div><div className="rounded-[22px] border border-[#e5e5e7] bg-white p-5"><h3 className="font-semibold">广场公约</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-[#6e6e73]"><li>· 不公开手机号、住址或证件信息</li><li>· 不攻击学校、地域、性别或人格类型</li><li>· 线下见面优先选择公共场所</li><li>· 不适内容可直接举报</li></ul></div></aside>
  </div>;
}

function formatRelative(value: string) {
  const distance = Date.now() - new Date(value).getTime();
  if (distance < 60_000) return "刚刚";
  if (distance < 3_600_000) return `${Math.floor(distance / 60_000)} 分钟前`;
  if (distance < 86_400_000) return `${Math.floor(distance / 3_600_000)} 小时前`;
  return new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
