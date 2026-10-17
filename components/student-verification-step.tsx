"use client";

import { useEffect, useState } from "react";
import { FileCheck2, GraduationCap, IdCard, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StudentVerificationMethod, VerificationSummary } from "@/lib/student-verification";

type Method = StudentVerificationMethod | "campus_email";
type State = { latest: VerificationSummary | null };
async function campusAction(body: Record<string, unknown>) {
  const response = await fetch("/api/onboarding", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "操作失败，请稍后再试。");
  return result.data;
}
export function StudentVerificationStep({ university = "" }: { university?: string | null; status?: string }) {
  const [method,setMethod] = useState<Method>("campus_email");
  const [school,setSchool] = useState(university || "");
  const [email,setEmail] = useState("");
  const [code,setCode] = useState("");
  const [sentTo,setSentTo] = useState("");
  const [demoCode,setDemoCode] = useState("");
  const [remaining,setRemaining] = useState(0);
  const [state,setState] = useState<State|null>(null);
  const [busy,setBusy] = useState(false);
  const [consent,setConsent] = useState(false);
  const [error,setError] = useState("");
  useEffect(()=>{if(remaining<=0)return; const timer=window.setTimeout(()=>setRemaining(value=>value-1),1000);return()=>window.clearTimeout(timer);},[remaining]);
  async function load() {
    const response=await fetch("/api/verification",{cache:"no-store"}), result=await response.json();
    if(!response.ok)throw Error(result.error || "认证状态读取失败");
    setState(result.data);
  }
  useEffect(()=>{let active=true;void fetch("/api/verification",{cache:"no-store"}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);if(active)setState(result.data);}).catch(()=>{if(active)setError("材料审核状态暂时无法读取，校园邮箱认证仍可使用。");});return()=>{active=false;};},[]);
  async function sendCode() {
    setBusy(true);setError("");
    try {
      const result=await campusAction({action:"send_code",email});
      setSentTo(email.trim().toLowerCase());setCode("");setDemoCode(result.demoCode || "");setRemaining(60);
      toast.success("验证码已发送到校园邮箱");
    }catch(error){setError(error instanceof Error?error.message:"发送失败");}
    finally{setBusy(false);}
  }
  async function withdraw() {
    setBusy(true);setError("");
    try {const response=await fetch("/api/verification",{method:"DELETE"}),result=await response.json();if(!response.ok)throw Error(result.error);await load();toast.success("已撤回并删除材料");}
    catch(error){setError(error instanceof Error?error.message:"撤回失败");}
    finally{setBusy(false);}
  }
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(busy)return;
    const form=event.currentTarget,body=new FormData(form);
    setBusy(true);setError("");
    try {
      if(method==="campus_email") {
        await campusAction({action:"verify_code",email,code,university:school});
        toast.success("校园邮箱认证成功");window.location.reload();return;
      }
      body.set("method",method);body.set("consent",String(consent));
      const response=await fetch("/api/verification",{method:"POST",body}),result=await response.json();
      if(!response.ok)throw Error(result.error || "提交失败");
      form.reset();setConsent(false);await load();toast.success("已提交，等待管理员审核");
    }catch(error){setError(error instanceof Error?error.message:"操作失败");}
    finally{setBusy(false);}
  }
  const latest=state?.latest,pending=latest?.status==="pending";
  const methods=[{id:"campus_email" as const,icon:Mail,title:"校园邮箱",text:"验证码验证 · 推荐"},{id:"chsi_code" as const,icon:GraduationCap,title:"学信网",text:"提交报告验证码"},{id:"student_card" as const,icon:IdCard,title:"学生证",text:"上传一张清晰照片"}];
  return <section className="verification-step rounded-[26px] border border-[#e0e8dc] bg-white p-5 sm:p-9" aria-labelledby="student-verification-title">
    <p className="text-xs tracking-widest text-[#71806d]">第 1 步 · 高校身份</p>
    <h2 id="student-verification-title" className="mt-3 text-2xl font-semibold">简单认证，认识同校与远方的同学</h2>
    <p className="mt-3 text-sm leading-7 text-[#687568]">任选一种方式即可。校园邮箱验证后直接继续；学信网和学生证由管理员审核。</p>
    <div className="mt-6 grid gap-3 sm:grid-cols-3">{methods.map(item=><button key={item.id} type="button" aria-pressed={method===item.id} onClick={()=>{setMethod(item.id);setError("");}} className={`rounded-2xl border p-4 text-left ${method===item.id?"border-[#286451] bg-[#edf3e9] ring-2 ring-[#286451]/10":"border-[#e0e5dd]"}`}><item.icon className="size-5 text-[#286451]"/><strong className="mt-3 block text-sm">{item.title}</strong><small className="mt-1 block text-[#6d786b]">{item.text}</small></button>)}</div>
    {latest && <div className="verification-result mt-5 rounded-xl bg-[#f3f6ef] p-4 text-sm leading-6" role="status"><strong>{pending?"材料审核中":latest.status==="approved"?"材料审核已通过":latest.status==="withdrawn"?"上次材料申请已撤回":"请补充认证材料"}</strong><p className="mt-1">{latest.review_note || (pending?"审核期间可以继续浏览，也可改用校园邮箱认证。":"")}</p>{pending&&<div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" type="button" onClick={()=>window.location.reload()}>刷新结果</Button><Button variant="ghost" type="button" onClick={withdraw} disabled={busy}>撤回修改</Button></div>}</div>}
    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {(method==="campus_email" || !pending)&&<form onSubmit={submit} className="mt-6 max-w-2xl space-y-5">
      <Field id="verification-university" label="学校名称"><Input id="verification-university" name="university" value={school} onChange={event=>setSchool(event.target.value)} minLength={2} maxLength={80} required placeholder="填写学校完整名称"/></Field>
      {method==="campus_email"?<>
        <Field id="verification-email" label="校园邮箱"><div className="flex flex-col gap-3 sm:flex-row"><Input id="verification-email" type="email" value={email} onChange={event=>{setEmail(event.target.value);setCode("");}} placeholder="name@university.edu.cn" autoComplete="email" required/><Button type="button" variant="outline" disabled={busy||!email.includes("@")||school.trim().length<2||remaining>0} onClick={sendCode}>{remaining>0?remaining+" 秒后重发":sentTo?"重新发送":"获取验证码"}</Button></div><p className="mt-2 text-xs leading-6 text-[#73806d]">支持 .edu.cn、.edu、.ac.cn 等教育邮箱；其他邮箱可选择学信网或学生证。</p></Field>
        {sentTo&&<div className="rounded-xl bg-[#f3f6ef] p-3 text-sm text-[#286451]" role="status">{demoCode?<span>本地演示验证码：<strong>{demoCode}</strong></span>:<span>验证码已发送至 {sentTo}，10 分钟内有效。</span>}</div>}
        <Field id="verification-email-code" label="邮箱验证码"><Input id="verification-email-code" value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" placeholder="填写 6 位验证码" required pattern="[0-9]{6}"/></Field>
      </>:method==="chsi_code"?<>
        <p className="rounded-xl bg-[#f6f7f2] p-4 text-sm leading-7 text-[#60705d]">提交《教育部学籍在线验证报告》下方的在线验证码即可，无需重复填写姓名、学号和毕业日期。<a href="https://www.chsi.com.cn/" target="_blank" rel="noopener noreferrer" className="ml-2 text-[#286451] underline">前往学信网 ↗</a></p>
        <Field id="verification-code" label="学籍报告在线验证码"><Input id="verification-code" name="identifier" required minLength={12} maxLength={24} autoComplete="off" placeholder="12 或 16 位，不是短信验证码"/></Field>
      </>:<>
        <p className="rounded-xl bg-[#f6f7f2] p-4 text-sm leading-7 text-[#60705d]">上传能看清学校、姓名和学号的学生证照片即可，无需手写口令或另外拍注册证明。请遮挡身份证号等无关信息。</p>
        <Field id="verification-identity-photo" label="学生证照片"><Input className="h-auto py-3" id="verification-identity-photo" name="identityPhoto" type="file" accept="image/jpeg,image/png,image/webp" required/><p className="mt-2 text-xs text-[#73806d]">一张 JPG、PNG 或 WebP，大小不超过 3MB。</p></Field>
      </>}
      {method!=="campus_email"&&<label className="flex items-start gap-3 text-sm leading-6 text-[#5e6d5a]"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)} className="mt-1 size-4 shrink-0 accent-[#286451]"/><span>我确认材料属于本人，同意仅用于高校身份审核。材料仅管理员可见，审核或撤回后删除。</span></label>}
      <Button type="submit" disabled={busy||(method==="campus_email"?(code.length!==6||sentTo!==email.trim().toLowerCase()):(!state||!consent))} className="rounded-full bg-[#286451] px-6 hover:bg-[#205340]">{busy?<Loader2 className="size-4 animate-spin"/>:method==="campus_email"?<Mail className="size-4"/>:<FileCheck2 className="size-4"/>}{busy?"请稍候…":method==="campus_email"?"验证并继续":"提交审核"}</Button>
    </form>}
    <p className="mt-6 border-t border-[#e1e8dc] pt-4 text-xs leading-6 text-[#72816d]">认证资料不向其他用户公开。个人页面会显示认证方式；校园邮箱认证代表已验证邮箱归属。</p>
  </section>;
}
function Field({label,id,children}:{label:string;id:string;children:React.ReactNode}) {return <div><label htmlFor={id} className="mb-2 block text-sm font-medium">{label}</label>{children}</div>;}
