"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Compass, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const resultStorageKey = "campus-personality-result-v1";
const validTypes = new Set([
  "ISTJ", "ISTP", "ISFJ", "ISFP", "INFJ", "INFP", "INTJ", "INTP",
  "ESTJ", "ESTP", "ESFJ", "ESFP", "ENFJ", "ENFP", "ENTJ", "ENTP",
]);
const scoreKeys = ["energy", "information", "decision", "rhythm"] as const;
const traitKeys = ["connection", "expression", "conflict", "exploration"] as const;

function parseNumbers(raw: string | null, length: number, limit: number) {
  if (!raw) return null;
  const values = raw.split(",").map(Number);
  if (values.length !== length || values.some((value) => !Number.isFinite(value))) return null;
  return values.map((value) => Math.max(-limit, Math.min(limit, value)));
}

export function ResultHandoff() {
  const [status, setStatus] = useState<"loading" | "ready" | "invalid">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = (params.get("type") || "").toUpperCase();
    const scores = parseNumbers(params.get("s"), scoreKeys.length, 12);
    const traits = parseNumbers(params.get("r"), traitKeys.length, 4);
    if (!validTypes.has(type) || !scores || !traits) {
      queueMicrotask(() => setStatus("invalid"));
      return;
    }

    const result = {
      type,
      scores: Object.fromEntries(scoreKeys.map((key, index) => [key, scores[index]])),
      traits: Object.fromEntries(traitKeys.map((key, index) => [key, traits[index]])),
      completedAt: new Date().toISOString(),
      source: "wx-mini",
    };
    window.localStorage.setItem(resultStorageKey, JSON.stringify(result));
    queueMicrotask(() => setStatus("ready"));
    const timer = window.setTimeout(() => window.location.replace("/match"), 700);
    return () => window.clearTimeout(timer);
  }, []);

  return <main className="grid min-h-screen place-items-center bg-[#f5f5f7] px-5 py-12 text-[#1d1d1f]">
    <section className="w-full max-w-lg rounded-[28px] border border-[#e5e5e7] bg-white p-7 text-center shadow-[0_20px_55px_rgba(23,36,31,.08)] sm:p-10">
      <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#286451] text-white"><Compass className="size-5" /></span>
      {status === "loading" && <><Loader2 className="mx-auto mt-8 size-7 animate-spin text-[#286451]" /><h1 className="mt-5 font-sans text-3xl font-semibold">正在接收测试结果</h1><p className="mt-3 text-[#6e6e73]">请稍候，即将进入同频匹配。</p></>}
      {status === "ready" && <><CheckCircle2 className="mx-auto mt-8 size-8 text-[#286451]" /><h1 className="mt-5 font-sans text-3xl font-semibold">测试结果已带入</h1><p className="mt-3 leading-7 text-[#6e6e73]">登录后会自动同步到你的同频资料，无需重新作答。</p><Button asChild className="mt-7 rounded-full bg-[#286451] hover:bg-[#205340]"><Link href="/match">继续进入匹配<ArrowRight className="ml-2 size-4" /></Link></Button></>}
      {status === "invalid" && <><h1 className="mt-8 font-sans text-3xl font-semibold">入口链接无效</h1><p className="mt-3 leading-7 text-[#6e6e73]">测试结果参数不完整，请返回小程序结果页重新获取入口。</p><Button asChild variant="outline" className="mt-7 rounded-full"><Link href="/">返回网页版首页</Link></Button></>}
    </section>
  </main>;
}
