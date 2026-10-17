"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { verificationMethodLabel } from "@/lib/student-verification";

type Evidence = {name?:string;studentNumber?:string;code:string;challenge?:string;enrollmentUntil?:string;images:string[];university:string;method:string};
export function VerificationReview({request,close,reviewed}:{request:{id:number;display_name:string;method:string;evidence_version:number};close:()=>void;reviewed:(id:number,status:"approved"|"rejected")=>void}) {
  const [evidence,setEvidence]=useState<Evidence|null>(null);
  const [error,setError]=useState("");
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;if(!request.evidence_version)return;
    void fetch("/api/admin/verification?id="+request.id,{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);if(active)setEvidence(result.data);}).catch(error=>{if(active)setError(error instanceof Error?error.message:"材料读取失败");});
    return()=>{active=false;};
  },[request.id,request.evidence_version]);
  async function review(status:"approved"|"rejected") {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"review_verification",requestId:request.id,status,note})}),result=await response.json();
      if(!response.ok)throw Error(result.error);
      reviewed(request.id,status);toast.success(status==="approved"?"高校认证已通过":"已退回，申请人可查看理由");close();
    }catch(error){setError(error instanceof Error?error.message:"审核失败");}
    finally{setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)close();}}><DialogContent className="verification-review max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>审核 {request.display_name} 的高校身份</DialogTitle><DialogDescription>确认关键材料能证明高校身份后即可通过，无需逐项勾选或设置日期。</DialogDescription></DialogHeader>
    {!request.evidence_version&&<p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">这份旧申请没有可核验材料，请退回补交。</p>}
    {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {evidence&&<div className="space-y-4"><div className="rounded-xl bg-[#f2f6ee] p-4 text-sm"><strong>{evidence.university}</strong><p className="mt-1 text-[#667660]">{verificationMethodLabel(evidence.method)}</p>{evidence.name&&<p className="mt-2">{evidence.name} · {evidence.studentNumber}</p>}</div>
      {evidence.method==="chsi_code"?<div className="rounded-xl border p-4 text-sm leading-7"><p>学籍报告验证码：<strong className="break-all font-mono">{evidence.code}</strong></p><a href="https://www.chsi.com.cn/xlcx/bgcx.jsp" target="_blank" rel="noopener noreferrer" className="text-[#286451] underline">到学信网核对报告 ↗</a><p className="mt-2 text-slate-500">查看有效学籍报告，确认学校和高校身份。格式正确本身不代表认证通过。</p></div>:<div className="space-y-3">{evidence.images.map((image,index)=><Image key={index} unoptimized width={1600} height={1600} src={image} alt={index===0?"学生证照片":"补充凭证"} className="max-h-[480px] h-auto w-full rounded-xl border object-contain"/>)}</div>}
    </div>}
    <label className="block text-sm font-medium">备注（通过时可不填；退回时填写原因）<Textarea className="mt-2" value={note} maxLength={300} onChange={event=>setNote(event.target.value)} placeholder="例如：照片模糊，请重新上传清晰的学生证。"/></label>
    <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={busy||note.trim().length<2} onClick={()=>review("rejected")}>退回修改</Button><Button className="bg-[#286451]" disabled={busy||!evidence} onClick={()=>review("approved")}>{busy?"正在处理…":"确认通过"}</Button></div>
    <p className="text-xs leading-6 text-slate-500">材料仅管理员可见，审核后删除。认证有效期由系统维护。</p>
  </DialogContent></Dialog>;
}
