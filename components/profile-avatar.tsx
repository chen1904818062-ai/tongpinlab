"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function ProfileAvatar({ src, name, className, sizes = "80px" }: { src?: string | null; name: string; className?: string; sizes?: string }) {
  return <AvatarImage key={src || "empty"} src={src} name={name} className={className} sizes={sizes} />;
}

function AvatarImage({ src, name, className, sizes }: { src?: string | null; name: string; className?: string; sizes: string }) {
  const [failed, setFailed] = useState(false);
  return <div className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#edf2ee] font-semibold text-[#286451]", className)}>
    {src && !failed ? <Image src={src} alt={`${name}的头像`} fill sizes={sizes} unoptimized={src.startsWith("/uploads/avatars/")} className="object-cover" onError={() => setFailed(true)} /> : <span aria-label={`${name}的默认头像`}>{name.slice(0, 1) || "同"}</span>}
  </div>;
}
