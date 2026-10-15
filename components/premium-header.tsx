import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Compass } from "lucide-react";

export function PremiumHeader({ home = false }: { home?: boolean }) {
  return (
    <header className="premium-header">
      <div className="premium-header-inner">
        <Link href="/" className="premium-brand" aria-label="同频实验室首页">
          <span className="premium-brand-mark"><Compass size={19} strokeWidth={1.5} /></span>
          <span>同频实验室<span className="premium-brand-en">TONGPIN</span></span>
        </Link>
        <nav aria-label="主导航" className="premium-nav">
          {home ? <>
            <a href="#experience" className="premium-nav-link">探索性格</a>
            <a href="#about" className="premium-nav-link">关于同频</a>
            <Link href="/match" className="premium-nav-cta">进入社区 <ArrowUpRight size={13} /></Link>
          </> : <Link href="/" className="premium-back"><ArrowLeft size={14} />返回首页</Link>}
        </nav>
      </div>
    </header>
  );
}
