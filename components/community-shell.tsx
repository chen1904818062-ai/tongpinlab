"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Compass, Loader2 } from "lucide-react";
import { PremiumHeader } from "@/components/premium-header";
import { Button } from "@/components/ui/button";
import { restoreCommunityAccess } from "@/lib/community-client";

export function CommunityGate() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "missing" | "error">("checking");
  useEffect(() => {
    let active = true;
    void restoreCommunityAccess().then((restored) => { if (!active) return; if (restored) router.refresh(); else setStatus("missing"); }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [router]);
  return <main className="community-page"><PremiumHeader /><section className="community-entry"><span className="community-entry-icon"><Compass size={27} /></span><p className="tp-kicker">同频社区 · 先认识自己</p><h1>带着自己的频率，<br />去听听别人的故事。</h1><p>完成 32 题性格探索，就可以免登录浏览。<br />想发言或匹配时，再完成认证与资料。</p>{status === "checking" ? <p className="community-checking"><Loader2 size={16} className="animate-spin" />正在检查当前设备保存的测评…</p> : status === "error" ? <><p role="alert">暂时无法恢复浏览进度，请稍后重试。</p><Button onClick={() => window.location.reload()}>重新检查</Button></> : <Button asChild className="premium-primary"><Link href="/test">开始 / 继续性格测试<ArrowRight size={16} /></Link></Button>}<Link href="/" className="community-home-link">先回首页看看</Link></section></main>;
}
