"use client";

import { BrandMark } from "@/components/brand-mark";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

export function PremiumHeader({ home = false, onHome }: { home?: boolean; onHome?: () => void }) {
  return (
    <header className="premium-header">
      <div className="premium-header-inner">
        <Link href="/" onClick={onHome} className="premium-brand" aria-label="同频实验室首页">
          <BrandMark />
          <span>同频实验室<span className="premium-brand-en">校园性格与关系</span></span>
        </Link>
        <nav aria-label="主导航" className="premium-nav">
          {home ? <>
            <a href="#experience" className="premium-nav-link">性格手记</a>
            <a href="#about" className="premium-nav-link">同频社区</a>
            <Link href="/match" className="premium-nav-cta">进入社区 <ArrowUpRight size={13} /></Link>
          </> : <Link href="/" onClick={onHome} className="premium-back"><ArrowLeft size={14} />返回首页</Link>}
        </nav>
      </div>
    </header>
  );
}
