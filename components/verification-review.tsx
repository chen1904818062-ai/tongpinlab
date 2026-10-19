"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { verificationMethodLabel } from "@/lib/student-verification";

type Evidence = {name?:string;studentNumber?:string;code:string;challenge?:string;enrollmentUntil?:string;images:string[];university:string;method:string};
export function VerificationReview({request,close,reviewed}:{request:{id:number;display_name:string;method:string;evidence_version:number;university:string;identifier:string;note:string|null;status:string;created_at:string;review_note:string|null};close:()=>void;reviewed:(id:number,status:"approved"|"rejected")=>void}) {
  const [evidence,setEvidence]=useState<Evidence|null>(null);
  const [error,setError]=useState("");
  const [attempt,setAttempt]=useState(0);
  const [expanded,setExpanded]=useState(false);
  const pending=request.status==="pending";
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  useEffect(()=>{
    let active=true;if(!pending||!request.evidence_version)return;
    void fetch("/api/admin/verification?id="+request.id,{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);if(active)setEvidence(result.data);}).catch(error=>{if(active)setError(error instanceof Error?error.message:"材料读取失败");});
    return()=>{active=false;};
  },[request.id,request.evidence_version,pending,attempt]);
  async function review(status:"approved"|"rejected") {
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"review_verification",requestId:request.id,status,note})}),result=await response.json();
      if(!response.ok)throw Error(result.error);
      reviewed(request.id,status);toast.success(status==="approved"?"高校认证已通过":"已退回，申请人可查看理由");close();
    }catch(error){setError(error instanceof Error?error.message:"审核失败");}
    finally{setBusy(false);}
  }
  return <Dialog open onOpenChange={open=>{if(!open&&!busy)close();}}><DialogContent className="verification-review max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{pending?"审核":"查看"} {request.display_name} 的高校身份</DialogTitle><DialogDescription>确认关键材料能证明高校身份后即可通过，无需逐项勾选或设置日期。</DialogDescription></DialogHeader>
    <dl className="grid min-w-0 gap-3 rounded-xl bg-[#f2f6ee] p-4 text-sm sm:grid-cols-2">{[["申请人",request.display_name],["学校",request.university],["认证方式",verificationMethodLabel(request.method)],["提交时间",new Date(request.created_at).toLocaleString("zh-CN")],["材料类型",request.identifier],["申请状态",({pending:"待审核",approved:"已通过",rejected:"已退回",withdrawn:"已撤回"} as Record<string,string>)[request.status]||request.status]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{value||"未填写"}</dd></div>)}</dl>
    {request.note&&<section><h3 className="text-sm font-medium">申请人补充说明</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 [overflow-wrap:anywhere]">{request.note}</p></section>}
    {!pending&&<div className="rounded-xl border p-4 text-sm leading-7"><h3 className="font-medium">处理结果</h3><p>{request.review_note||"暂无审核备注"}</p><p className="mt-2 text-slate-500">原始认证材料在审核完成、撤回或过期后清理，已清理的照片和报告码无法再次查看。</p></div>}
    {pending&&!!request.evidence_version&&!evidence&&!error&&<p role="status" className="py-6 text-center text-sm text-slate-500">正在读取认证材料…</p>}
    {pending&&!request.evidence_version&&<p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">这份旧申请没有可核验材料，请退回补交。</p>}
    {error&&<div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{!evidence&&!!request.evidence_version&&<Button variant="outline" className="mt-3" onClick={()=>{setError("");setAttempt(value=>value+1);}}>重新加载材料</Button>}</div>}
    {evidence&&<div className="space-y-4"><div className="rounded-xl bg-[#f2f6ee] p-4 text-sm"><strong>{evidence.university}</strong><p className="mt-1 text-[#667660]">{verificationMethodLabel(evidence.method)}</p>{evidence.name&&<p className="mt-2">{evidence.name} · {evidence.studentNumber}</p>}</div>
      {evidence.method==="chsi_code"?<div className="rounded-xl border p-4 text-sm leading-7"><p>学籍报告验证码：<strong className="break-all font-mono">{evidence.code}</strong></p><a href="https://www.chsi.com.cn/xlcx/bgcx.jsp" target="_blank" rel="noopener noreferrer" className="text-[#286451] underline">到学信网核对报告 ↗</a><p className="mt-2 text-slate-500">查看有效学籍报告，确认学校和高校身份。格式正确本身不代表认证通过。</p></div>:<div className="space-y-3">{evidence.images.map((image,index)=><Image key={index} onError={()=>setError("照片显示失败，请关闭后重新打开材料。")} unoptimized width={1600} height={1600} src={image} alt={index===0?"学生证照片":"补充凭证"} className={`${expanded?"":"max-h-[480px]"} h-auto w-full rounded-xl border object-contain`}/>)}</div>}
      {evidence.method==="student_card"&&<Button variant="outline" size="sm" onClick={()=>setExpanded(value=>!value)}>{expanded?"恢复预览大小":"放大查看照片"}</Button>}
    </div>}
    {pending&&<><label className="block text-sm font-medium">备注（通过时可不填；退回时填写原因）<Textarea className="mt-2" value={note} maxLength={300} onChange={event=>setNote(event.target.value)} placeholder="例如：照片模糊，请重新上传清晰的学生证。"/></label>
    <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={busy||note.trim().length<2} onClick={()=>review("rejected")}>退回修改</Button><Button className="bg-[#286451]" disabled={busy||!evidence||!!error} onClick={()=>review("approved")}>{busy?"正在处理…":"确认通过"}</Button></div>
    <p className="text-xs leading-6 text-slate-500">材料仅管理员可见，审核后删除。认证有效期由系统维护。</p></>}
  </DialogContent></Dialog>;
}
