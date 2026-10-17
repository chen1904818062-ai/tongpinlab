"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { BadgeCheck, Flag, Heart, Loader2, MessageCircle, PenLine, Send, Trash2, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PlazaPost, PlazaComment, PlazaSnapshot } from "@/lib/plaza-types";

async function request<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const result = await response.json() as { ok: boolean; data?: T; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "操作失败");
  return result.data as T;
}
function action<T>(payload: Record<string, unknown>) {
  return request<T>("/api/plaza", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
}
const categories = ["校园瞬间", "寻找同伴", "情绪树洞", "观点交换"];
const draftKey = "tongpin-plaza-draft-v2";
const visibleLabels: Record<string, string> = { national: "全国认证高校可见", same_university: "仅同校可见", public: "游客也可见 · 公开" };
type Props = { currentUserId: string; initialData?: PlazaSnapshot; canParticipate?: boolean; onRequireParticipation?: (reason: string, target?: string) => void };

export function SocialPlaza({ currentUserId, initialData, canParticipate = true, onRequireParticipation }: Props) {
  const [data, setData] = useState<PlazaSnapshot | null>(initialData || null);
  const [loading, setLoading] = useState(!initialData);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [category, setCategory] = useState(categories[0]);
  const [audience, setAudience] = useState("national");
  const [content, setContent] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [commentingPost, setCommentingPost] = useState<number | null>(null);
  const [draftsReady, setDraftsReady] = useState(false);
  const focused = useRef(false);
  const readUrl = canParticipate ? "/api/plaza" : "/api/community";
  const loadPlaza = useCallback(async () => {
    try { setData(await request<PlazaSnapshot>(readUrl)); }
    catch (error) { toast.error(error instanceof Error ? error.message : "广场加载失败"); }
    finally { setLoading(false); }
  }, [readUrl]);

  useEffect(() => {
    let active = true;
    if (!initialData) void request<PlazaSnapshot>(readUrl).then((snapshot) => { if (active) setData(snapshot); }).catch((error: unknown) => { if (active) toast.error(error instanceof Error ? error.message : "广场加载失败"); }).finally(() => { if (active) setLoading(false); });
    const timer = window.setInterval(() => {
      if (!document.hidden) void request<PlazaSnapshot>(readUrl).then((snapshot) => { if (active) setData(snapshot); }).catch(() => undefined);
    }, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [readUrl, initialData]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(draftKey) || "null") as { content?: string; category?: string; audience?: string; comments?: Record<string, unknown>; savedAt?: number } | null;
      if (saved && Number(saved.savedAt) > Date.now() - 7 * 86400_000) {
        const comments = Object.fromEntries(Object.entries(saved.comments || {}).filter(([id, value]) => /^-?\d+$/.test(id) && typeof value === "string").slice(0, 100).map(([id, value]) => [id, String(value).slice(0, 160)]));
        queueMicrotask(() => {
          setContent(String(saved.content || "").slice(0, 500));
          if (categories.includes(saved.category || "")) setCategory(saved.category!);
          if (["national", "same_university", "public"].includes(saved.audience || "")) setAudience(saved.audience!);
          setCommentDrafts(comments); setDraftsReady(true);
        });
        return;
      }
    } catch { /* invalid drafts must not stop browsing */ }
    queueMicrotask(() => setDraftsReady(true));
  }, []);
  useEffect(() => {
    if (!draftsReady) return;
    try { localStorage.setItem(draftKey, JSON.stringify({ content, category, audience, comments: commentDrafts, savedAt: Date.now() })); } catch { /* storage may be unavailable */ }
  }, [content, category, audience, commentDrafts, draftsReady]);
  useEffect(() => {
    if (focused.current || !data || !draftsReady) return;
    const params = new URLSearchParams(location.search);
    const id = Number(params.get("post"));
    if (params.has("post") && data.posts.some((post) => post.id === id)) {
      focused.current = true;
      queueMicrotask(() => setCommentingPost(id));
      requestAnimationFrame(() => document.getElementById(`plaza-post-${id}`)?.scrollIntoView({ block: "start" }));
    } else if (params.get("compose") === "1") {
      focused.current = true;
      requestAnimationFrame(() => document.getElementById("plaza-composer")?.scrollIntoView({ block: "start" }));
    }
  }, [data, draftsReady]);

  const visiblePosts = useMemo(() => {
    if (!data) return [];
    if (filter === "school") return data.posts.filter((post) => !post.official && post.university === data.viewer.university);
    if (filter === "personality") return data.posts.filter((post) => !post.official && post.personalityType === data.viewer.personalityType);
    return data.posts;
  }, [data, filter]);
  function requireParticipation(reason: string, target: string) { onRequireParticipation?.(reason, target); }

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!canParticipate) { requireParticipation("发布动态", "/community?compose=1"); return; }
    if (content.trim().length < 5 || busy) return;
    setBusy(true);
    try { await action({ action: "create_post", category, audience, content }); setContent(""); toast.success("已发布到同频广场"); await loadPlaza(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "发布失败"); }
    finally { setBusy(false); }
  }
  async function toggleLike(postId: number) {
    if (!canParticipate) { requireParticipation("点赞", `/community?post=${postId}`); return; }
    if (!data) return;
    const before = data;
    setData({ ...data, posts: data.posts.map((post) => post.id === postId ? { ...post, viewerLiked: !post.viewerLiked, likeCount: Math.max(0, post.likeCount + (post.viewerLiked ? -1 : 1)) } : post) });
    try {
      const result = await action<{ liked: boolean; likeCount: number }>({ action: "toggle_like", postId });
      setData((current) => current ? { ...current, posts: current.posts.map((post) => post.id === postId ? { ...post, viewerLiked: result.liked, likeCount: result.likeCount } : post) } : current);
    } catch (error) { setData(before); toast.error(error instanceof Error ? error.message : "点赞失败"); }
  }
  async function addComment(event: FormEvent, postId: number) {
    event.preventDefault();
    if (!canParticipate) { requireParticipation("发送评论", `/community?post=${postId}`); return; }
    const body = commentDrafts[postId]?.trim() || "";
    if (body.length < 2 || busy) return;
    setBusy(true);
    try {
      await action<PlazaComment>({ action: "add_comment", postId, body });
      setCommentDrafts((current) => ({ ...current, [postId]: "" }));
      toast.success("评论已发送"); await loadPlaza();
    } catch (error) { toast.error(error instanceof Error ? error.message : "评论失败"); }
    finally { setBusy(false); }
  }
  async function report(post: PlazaPost) {
    if (!canParticipate) { requireParticipation("反馈内容", `/community?post=${post.id}`); return; }
    if (!window.confirm("确认举报这条动态吗？")) return;
    try { await request("/api/reports", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetUserId: post.authorId, category: "广场内容", detail: `动态 #${post.id}：${post.content.slice(0, 120)}` }) }); toast.success("举报已提交"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "举报失败"); }
  }
  async function deletePost(post: PlazaPost) {
    if (!window.confirm("确认删除这条动态吗？")) return;
    try { await action({ action: "delete_post", postId: post.id }); await loadPlaza(); toast.success("动态已删除"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "删除失败"); }
  }

  if (loading) return <div className="plaza-loading"><Loader2 className="animate-spin" /><p>正在打开同频广场…</p></div>;
  const filters = [{ id: "all", label: canParticipate ? "全国广场" : "公开广场" }, ...(canParticipate && data?.viewer.university ? [{ id: "school", label: "同校动态" }] : []), { id: "personality", label: "同人格" }];
  return <div className="social-plaza-layout"><div className="plaza-feed">
    <section className="plaza-composer" id="plaza-composer"><form onSubmit={publish}><div className="plaza-composer-heading"><PenLine size={21} /><div><h2>说点此刻真实的</h2><p>{canParticipate ? "想分享给谁，由你决定。" : "可以先写下来；完成准备后再由你确认发布。"}</p></div></div><Textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="分享校园瞬间、寻找活动搭子，或回答小同和小频的提问…" maxLength={500} className="plaza-draft" /><div className="plaza-composer-controls"><div><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="动态分类">{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={audience} onChange={(event) => setAudience(event.target.value)} aria-label="可见范围"><option value="national">全国高校可见</option><option value="same_university">仅同校可见</option><option value="public">游客也可见（公开）</option></select></div><Button type="submit" disabled={busy || content.trim().length < 5}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}{canParticipate ? "发布" : "完成准备并发布"}</Button></div><p className="plaza-visibility-note">{audience === "public" ? "这条动态及其评论对完成测评的游客也可见。" : audience === "same_university" ? "仅完成认证和准备的同校用户可见，不向游客公开。" : "仅完成认证和准备的高校用户可见，不向游客公开。"}<span>{content.length} / 500 · 草稿保存在当前设备</span></p></form></section>
    <nav className="plaza-filters" aria-label="广场筛选">{filters.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}</button>)}</nav>
    {visiblePosts.map((post) => <article key={post.id} id={`plaza-post-${post.id}`} className={`plaza-post ${post.official ? "is-official" : ""}`}><header><div className="plaza-author-avatar">{post.avatar ? <Image src={post.avatar} alt="" width={52} height={52} /> : post.authorName.slice(0, 1)}</div><div className="plaza-author"><div><strong>{post.authorName}</strong>{post.official ? <span className="plaza-official-badge">官方虚拟伙伴</span> : <BadgeCheck size={15} />}{post.personalityType && <span className="plaza-type">{post.personalityType}</span>}</div><p>{post.official ? "官方常驻话题 · 欢迎真实同学接着聊" : `${post.university} · ${formatRelative(post.createdAt)} · ${visibleLabels[post.audience] || "认证用户可见"}`}</p></div>{!post.official && (post.authorId === currentUserId ? <button type="button" onClick={() => void deletePost(post)} aria-label="删除动态"><Trash2 size={16} /></button> : <button type="button" onClick={() => void report(post)} aria-label="举报动态"><Flag size={16} /></button>)}</header><span className="plaza-category">{post.category}</span><p className="plaza-post-content">{post.content}</p><div className="plaza-post-actions"><button type="button" onClick={() => void toggleLike(post.id)} aria-pressed={post.viewerLiked}><Heart size={17} className={post.viewerLiked ? "fill-current" : ""} />{post.likeCount || "赞"}</button><button type="button" onClick={() => setCommentingPost(commentingPost === post.id ? null : post.id)}><MessageCircle size={17} />{post.commentCount ? `${post.commentCount} 条评论` : "接一句话"}</button></div>
    {post.comments.length > 0 && <div className="plaza-comments">{post.comments.map((comment) => <div key={comment.id} className={comment.official ? "plaza-auto-reply" : ""}><strong>{comment.authorName}</strong>{comment.official && <span>官方预设引导</span>}<p>{comment.body}</p></div>)}</div>}
    {commentingPost === post.id && <form onSubmit={(event) => void addComment(event, post.id)} className="plaza-comment-form"><p>{post.audience === "public" ? "这是公开话题，评论也会对完成测评的游客展示。" : "评论沿用这条动态的可见范围。"}{!canParticipate && " 草稿会保留，完成准备后可以回来发送。"}</p><div><Input aria-label="评论内容" value={commentDrafts[post.id] || ""} onChange={(event) => setCommentDrafts((current) => ({ ...current, [post.id]: event.target.value }))} maxLength={160} placeholder="聊聊你的经历或感受…" /><Button type="submit" disabled={busy || (commentDrafts[post.id]?.trim().length || 0) < 2} aria-label="发送评论"><Send size={16} /></Button></div></form>}</article>)}
    {!visiblePosts.length && <div className="plaza-empty"><UsersRound size={29} /><h3>还没有这一类动态。</h3><p>可以先逛逛公开话题，看看哪些经历让你有共鸣。</p><button type="button" onClick={() => setFilter("all")}>看看其他话题</button></div>}
    </div><aside className="plaza-sidebar"><section><h3>性格是线索，真实交流才是主角。</h3><p>小同和小频是官方虚拟伙伴，产品说明与评论引导来自预设内容，不是真人，也不会进入匹配池。</p></section><section><h3>把边界，也留在对话里。</h3><ul><li>不公开手机号、住址和证件信息。</li><li>公开话题下的评论也对游客可见。</li><li>不攻击学校、地域、性别或性格。</li><li>遇到不适内容可以举报。</li></ul></section></aside></div>;
}
function formatRelative(value: string) {
  const distance = Math.max(0, Date.now() - new Date(value).getTime());
  if (distance < 60_000) return "刚刚";
  if (distance < 3_600_000) return `${Math.floor(distance / 60_000)} 分钟前`;
  if (distance < 86_400_000) return `${Math.floor(distance / 3_600_000)} 小时前`;
  return new Date(value).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
