import type { Metadata } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "同频实验室｜全国高校学生性格测试与社交社区",
  description: "从 32 个真实校园情境了解 MBTI 与关系性格；认证高校身份后，进入全国高校匹配、私信和社交广场。",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}<footer className="border-t border-[#dce5d0] bg-[#f6f7f5] px-4 py-5 text-center text-xs text-[#71806e]"><a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">闽ICP备2026041377号-1</a></footer><Toaster richColors position="top-center" /></body>
    </html>
  );
}
