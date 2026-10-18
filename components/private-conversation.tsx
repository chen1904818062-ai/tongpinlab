"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, BadgeCheck, ChevronDown, Loader2, MessageCircle, RefreshCw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { conversationTopics, icebreakerCategories, type IcebreakerCategory } from "@/lib/icebreakers";
import { verificationMethodLabel } from "@/lib/student-verification";

export type PrivateMessage = { id: number; senderId: string; body: string; status: string; createdAt: string };
type Person = { name: string; photoUrl: string | null; university?: string; grade?: string; personalityType?: string | null; verificationMethod?: string; interests: string[] };
const clock = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false });
const day = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "long", day: "numeric", weekday: "long" });
export function PrivateConversation({ userId, matchId, person, messages, myInterests, onSend }: { userId: string; matchId: number; person: Person; messages: PrivateMessage[]; myInterests: string[]; onSend: (body: string) => Promise<void> }) {
  const [draft, setDraft] = useState(""), [sending, setSending] = useState(false), [error, setError] = useState("");
  const [showTopics, setShowTopics] = useState(messages.length === 0), [category, setCategory] = useState<IcebreakerCategory>("轻松开场"), [group, setGroup] = useState(0), [unread, setUnread] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null), feed = useRef<HTMLDivElement>(null), nearBottom = useRef(true), inFlight = useRef(false), firstScroll = useRef(true);
  const draftKey = `tongpin-chat-draft-v1:${userId}:${matchId}`;
  const shared = useMemo(() => person.interests.filter(value => myInterests.includes(value)), [person.interests, myInterests]);
  const topics = conversationTopics(category, shared, group);
  const last = messages.at(-1);
  useEffect(() => { let active = true; queueMicrotask(() => { if (!active) return; try { setDraft((sessionStorage.getItem(draftKey) || "").slice(0, 500)); } catch { /* storage may be disabled */ } }); return () => { active = false; }; }, [draftKey]);
  useEffect(() => { if (input.current) { input.current.style.height = "auto"; input.current.style.height = `${Math.min(input.current.scrollHeight, 152)}px`; } }, [draft]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (!feed.current) return;
      if (firstScroll.current || nearBottom.current || last?.senderId === userId) { feed.current.scrollTop = feed.current.scrollHeight; setUnread(0); }
      else setUnread(value => value + 1);
      firstScroll.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [last?.id, last?.senderId, messages.length, userId]);
  function updateDraft(value: string) {
    setDraft(value); setError("");
    try { if (value) sessionStorage.setItem(draftKey, value); else sessionStorage.removeItem(draftKey); } catch { /* chat still works */ }
  }
  function chooseTopic(prompt: string) {
    const text = draft.trim() ? `${draft}\n${prompt}` : prompt;
    if (text.length > 500) { toast.info("输入框已有较多内容，可以先发送或修改后再选话题。"); return; }
    updateDraft(text); input.current?.focus();
  }
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const body = draft.trim(); if (!body || inFlight.current) return;
    inFlight.current = true; setSending(true); setError("");
    try { await onSend(body); updateDraft(""); nearBottom.current = true; }
    catch (error) { setError(error instanceof Error ? error.message : "暂时发送失败，内容已保留，请重试。"); }
    finally { inFlight.current = false; setSending(false); requestAnimationFrame(() => input.current?.focus()); }
  }
  function scrollLatest() { if (feed.current) feed.current.scrollTop = feed.current.scrollHeight; nearBottom.current = true; setUnread(0); }
  return <section className="private-conversation" aria-label={`与${person.name}的私信`}><aside className="private-sidebar"><span className="private-eyebrow">一句话，让距离近一点</span><h2>同频私信<span>01</span></h2><div className="private-person-card"><Avatar person={person} /><div><strong>{person.name}</strong><p>{person.university || "高校同学"}</p></div><MessageCircle size={16} /></div><div className="private-sidebar-detail"><span>{person.personalityType || "同频相遇"}</span><p>{messages.at(-1)?.body || "已经双向选择，慢慢聊就好。"}</p></div><div className="private-shared"><span className="private-eyebrow">从共同点开始</span><h3>{shared.length ? "你们都感兴趣" : "给对话一点好奇心"}</h3>{shared.length ? <div>{shared.slice(0, 5).map(value => <span key={value}>{value}</span>)}</div> : <p>一段校园日常，一个最近的发现，都可以成为开场。</p>}<button type="button" onClick={() => { setCategory(shared.length ? "兴趣交换" : "轻松开场"); setGroup(0); setShowTopics(true); }}>挑一句破冰话题<ArrowUpRight size={14} /></button></div><p className="private-sidebar-note"><ShieldCheck size={15} />舒服的节奏，由你们一起决定。</p></aside><div className="private-main"><header className="private-chat-header"><div className="private-chat-identity"><Avatar person={person} /><div><h2>{person.name}<BadgeCheck size={16} /></h2><p>{verificationMethodLabel(person.verificationMethod)}<span>·</span>双向选择已解锁</p></div></div><button type="button" className={showTopics ? "private-topic-toggle is-active" : "private-topic-toggle"} aria-expanded={showTopics} onClick={() => setShowTopics(value => !value)}><Sparkles size={15} /><span>破冰话题</span><ChevronDown size={13} /></button></header>
    {showTopics && <section className="private-icebreakers" aria-label="破冰话题"><div className="private-topics-heading"><span><Sparkles size={15} />把开场说得自然一点</span><button type="button" aria-label="收起破冰话题" onClick={() => setShowTopics(false)}><X size={15} /></button></div><div className="private-topic-categories">{icebreakerCategories.map(value => <button key={value} type="button" aria-pressed={category === value} onClick={() => { setCategory(value); setGroup(0); }}>{value}</button>)}<button className="private-refresh-topics" type="button" onClick={() => setGroup(value => value + 1)}><RefreshCw size={12} />换一组</button></div><div className="private-topic-cards">{topics.map(topic => <button key={topic.title} type="button" disabled={sending} onClick={() => chooseTopic(topic.prompt)} aria-label={`使用破冰话题：${topic.title}`}><strong>{topic.title}<ArrowUpRight size={13} /></strong><span>{topic.prompt}</span></button>)}</div><p>点选后填入输入框，你可以改一改再发送。</p></section>}
    <div className="private-feed-wrap"><div className="private-message-feed" ref={feed} role="log" aria-label="对话消息" aria-live="polite" aria-relevant="additions" onScroll={() => { const el = feed.current; if (!el) return; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80; if (nearBottom.current && unread) setUnread(0); }}>
      {!messages.length && <div className="private-chat-welcome"><span><MessageCircle size={27} /></span><h3>你们的第一句，还留着位置。</h3><p>从一个小问题开始。真诚、轻松，就很好。</p><button type="button" onClick={() => setShowTopics(true)}>看看破冰话题<ArrowUpRight size={14} /></button></div>}
      {messages.map((item, index) => { const mine = item.senderId === userId, previous = messages[index - 1], currentDay = day.format(new Date(item.createdAt)), newDay = !previous || day.format(new Date(previous.createdAt)) !== currentDay; return <div key={item.id}>{newDay && <div className="private-day-divider"><span>{currentDay}</span></div>}<div className={mine ? "private-message is-mine" : "private-message"}>{!mine && <Avatar person={person} />}<div className="private-message-content"><p>{item.body}</p><time dateTime={item.createdAt}>{clock.format(new Date(item.createdAt))}{mine && <span>已发送</span>}</time></div></div></div>; })}
    </div>{unread > 0 && <button type="button" className="private-new-messages" onClick={scrollLatest}><ArrowDown size={14} />有新消息</button>}</div>
    <form className="private-composer" onSubmit={send}><label className="sr-only" htmlFor="private-message-input">私信内容</label><textarea id="private-message-input" ref={input} value={draft} onChange={event => updateDraft(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={500} rows={2} disabled={sending} placeholder="从一句真诚的话开始…" /><div className="private-composer-toolbar"><span><span className="private-keyboard-note">Enter 发送 · Shift + Enter 换行</span><span className="private-counter">{draft.length} / 500</span></span><button type="submit" disabled={sending || !draft.trim()} aria-label="发送私信">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}<span>{sending ? "发送中" : "发送"}</span></button></div>{error && <p className="private-send-error" role="alert">{error} 内容已保留，可再次发送。</p>}</form></div></section>;
}
function Avatar({ person }: { person: Person }) { return person.photoUrl ? <Image src={person.photoUrl} alt="" width={44} height={44} className="private-avatar" /> : <span className="private-avatar private-avatar-letter" aria-hidden="true">{person.name.slice(0, 1)}</span>; }
