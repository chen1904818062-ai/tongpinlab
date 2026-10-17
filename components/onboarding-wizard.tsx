"use client";

import { BrandMark } from "@/components/brand-mark";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Check, FileCheck2, GraduationCap, Heart, IdCard, Loader2, LockKeyhole, LogOut, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { allQuestions, questionSections, scaleLabels } from "@/lib/product-data";
import { useOnboardingDraft } from "@/lib/use-onboarding-draft";

type InitialData = {
  user: { id: string; displayName: string; role: string; campusEmail: string | null; campusVerified: boolean; questionnaireCompleted: boolean; onboardingStep: number; university?: string | null; verificationMethod?: string | null; verificationStatus?: string } | null;
  profile: { gender: string; grade: string; major: string; campus: string; hometown: string; height: number | null; smoking: string; lookingFor: string; bio: string; interests: string[]; photoUrl?: string | null } | null;
  answers: Record<string, number>;
};

async function post<T>(payload: Record<string, unknown>) {
  const response = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const result = await response.json() as { ok: boolean; data?: T; error?: string };
  if (!response.ok || !result.ok) throw new Error(result.error || "保存失败");
  return result.data as T;
}

function startingStep(data: InitialData) {
  const completeStep = questionSections.length + 2;
  if (!data.user?.campusVerified) return 0;
  if (!data.profile?.major || !data.profile.gender || !data.profile.grade || !data.profile.bio) return 1;
  if (data.user?.questionnaireCompleted && allQuestions.every((question) => data.answers[question.id])) return completeStep;
  const firstIncomplete = questionSections.findIndex((section) => section.questions.some((question) => !data.answers[question.id]));
  return firstIncomplete < 0 ? questionSections.length + 1 : firstIncomplete + 2;
}

export function OnboardingWizard({ initialData, signOutPath, returnTo = "/community" }: { initialData: InitialData; signOutPath: string; returnTo?: string }) {
  const [step, setStep] = useState(() => startingStep(initialData));
  const [email, setEmail] = useState(initialData.user?.campusEmail || "");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [demoCode, setDemoCode] = useState("");
  const [verificationMethod, setVerificationMethod] = useState<"campus_email" | "chsi_code" | "student_card">((initialData.user?.verificationMethod as "campus_email" | "chsi_code" | "student_card") || "campus_email");
  const [university, setUniversity] = useState(initialData.user?.university || "");
  const [verificationIdentifier, setVerificationIdentifier] = useState("");
  const [verificationNote, setVerificationNote] = useState("");
  const [verificationStatus, setVerificationStatus] = useState(initialData.user?.verificationStatus || "unverified");
  const [busy, setBusy] = useState(false);
  const [questionnaireCompleted, setQuestionnaireCompleted] = useState(Boolean(initialData.user?.questionnaireCompleted));
  const [campusVerified, setCampusVerified] = useState(Boolean(initialData.user?.campusVerified));
  const [profileReady, setProfileReady] = useState(Boolean(initialData.profile?.major && initialData.profile?.gender && initialData.profile?.grade && initialData.profile?.bio));
  const [answers, setAnswers] = useState(initialData.answers);
  const [profile, setProfile] = useState({
    nickname: initialData.user?.displayName || "",
    gender: initialData.profile?.gender === "男" ? "男生" : initialData.profile?.gender === "女" ? "女生" : ["男生", "女生"].includes(initialData.profile?.gender || "") ? initialData.profile!.gender : "",
    grade: initialData.profile?.grade || "",
    major: initialData.profile?.major || "",
    campus: initialData.profile?.campus || "",
    hometown: initialData.profile?.hometown || "",
    height: initialData.profile?.height ? String(initialData.profile.height) : "",
    smoking: initialData.profile?.smoking || "不吸烟",
    lookingFor: initialData.profile?.lookingFor || "relationship",
    bio: initialData.profile?.bio || "",
    interests: initialData.profile?.interests.join("，") || "",
    photoUrl: initialData.profile?.photoUrl || "",
  });
  const answeredCount = allQuestions.filter((question) => Boolean(answers[question.id])).length;
  const { ready: draftReady, markProfileSaved, markAnswersSaved } = useOnboardingDraft(initialData.user?.id || "", profile, setProfile, answers, setAnswers);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const savedAnswers = useRef({ ...initialData.answers });
  const [saveStatus, setSaveStatus] = useState("");
  const [saveRetry, setSaveRetry] = useState(0);
  const completeStep = questionSections.length + 2;
  const lastQuestionStep = questionSections.length + 1;
  const questionnaireProgress = allQuestions.length ? (answeredCount / allQuestions.length) * questionSections.length : 0;
  const progress = questionnaireCompleted ? 100 : Math.round((((campusVerified ? 1 : 0) + (profileReady ? 1 : 0) + questionnaireProgress) / (questionSections.length + 2)) * 100);
  const navItems = useMemo(() => ["校园认证", "基本资料", ...questionSections.map((item) => item.title), "完成"], []);

  useEffect(() => {
    const section = questionSections[step - 2];
    if (!draftReady || busy || !section) return;
    const changed = Object.fromEntries(section.questions.filter((question) => Number.isInteger(answers[question.id]) && answers[question.id] >= 1 && answers[question.id] <= 5 && savedAnswers.current[question.id] !== answers[question.id]).map((question) => [question.id, answers[question.id]]));
    if (!Object.keys(changed).length) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSaveStatus("匹配问卷正在自动保存…");
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() => post({ action: "save_section", dimension: section.id, answers: changed })).then(() => {
        savedAnswers.current = { ...savedAnswers.current, ...changed };
        markAnswersSaved(changed);
        if (active) setSaveStatus("匹配问卷已同步到账号，可以稍后继续。");
      }).catch(() => { if (active) setSaveStatus("本次回答未同步，设备草稿已保留。"); });
    }, 800);
    return () => { active = false; window.clearTimeout(timer); };
  }, [answers, step, busy, draftReady, markAnswersSaved, saveRetry]);

  useEffect(() => {
    if (email) return;
    const pendingEmail = window.localStorage.getItem("campus-login-email");
    if (pendingEmail) queueMicrotask(() => setEmail(pendingEmail));
  }, [email]);

  useEffect(() => {
    const saved = window.localStorage.getItem("campus-personality-result-v1");
    if (!saved) return;
    try {
      const result = JSON.parse(saved) as { type?: string; scores?: Record<string, number> };
      if (result.type) void fetch("/api/personality", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) });
    } catch { /* keep onboarding usable if local result is invalid */ }
  }, []);

  function updateProfile(key: string, value: string) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function sendCode() {
    setBusy(true);
    try {
      const result = await post<{ delivery: "email" | "demo"; demoCode?: string }>({ action: "send_code", email });
      setCodeSent(true);
      setDemoCode(result.demoCode || "");
      toast.success(result.delivery === "email" ? "验证码已发送到校园邮箱" : "演示验证码已生成");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "发送失败");
    } finally { setBusy(false); }
  }

  async function verifyCode() {
    setBusy(true);
    try {
      await post({ action: "verify_code", email, code, university });
      window.localStorage.removeItem("campus-login-email");
      setCampusVerified(true);
      setVerificationStatus("approved");
      toast.success("校园身份验证成功");
      setStep(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "验证失败");
    } finally { setBusy(false); }
  }

  async function submitManualVerification() {
    setBusy(true);
    try {
      await post({ action: "submit_verification", method: verificationMethod, university, identifier: verificationIdentifier, note: verificationNote });
      setVerificationStatus("pending");
      toast.success("认证材料已提交，审核结果会保存在这里");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交失败");
    } finally { setBusy(false); }
  }

  async function saveBasicProfile() {
    if (!profile.nickname || !profile.gender || !profile.grade || !profile.major || !profile.bio) {
      toast.error("请完成昵称、性别、年级、专业和自我介绍");
      return;
    }
    setBusy(true);
    try {
      await post({ action: "save_profile", profile });
      markProfileSaved(profile);
      setProfileReady(true);
      toast.success("基本资料已保存");
      if (questionnaireCompleted) {
        setStep(completeStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setStep(2);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally { setBusy(false); }
  }

  async function saveSection() {
    const section = questionSections[step - 2];
    if (!section) return;
    const sectionAnswers = Object.fromEntries(section.questions.map((question) => [question.id, answers[question.id]]));
    const missing = section.questions.filter((question) => !answers[question.id]);
    if (missing.length) {
      toast.error(`这一页还有 ${missing.length} 题未回答`);
      document.getElementById(missing[0].id)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      await saveQueue.current.catch(() => undefined);
      await post({ action: "save_section", dimension: section.id, answers: sectionAnswers });
      markAnswersSaved(sectionAnswers);
      savedAnswers.current = { ...savedAnswers.current, ...sectionAnswers };
      if (questionnaireCompleted) {
        toast.success(`${section.title}已更新`);
        setStep(completeStep);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const firstIncomplete = questionSections.findIndex((item) => item.questions.some((question) => !answers[question.id]));
        if (firstIncomplete >= 0) {
          toast.success(`${section.title}已保存`);
          setStep(firstIncomplete + 2);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        await post({ action: "complete" });
        setQuestionnaireCompleted(true);
        toast.success("准备已完成，正在回到刚才的页面");
        window.location.replace(returnTo);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally { setBusy(false); }
  }

  return (
    <main className="premium-onboarding min-h-screen bg-[#f6f7f5] text-[#202b2b]">
      <header className="border-b border-[#e3e9e3] bg-[#f6f7f5]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" target="_top" className="flex items-center gap-3"><BrandMark /><strong>同频实验室</strong></Link>
          <div className="flex items-center gap-3">{initialData.user?.role === "admin" && <Button asChild variant="ghost" size="sm"><Link href="/admin">管理后台</Link></Button>}<div className="hidden items-center gap-2 text-sm text-slate-500 sm:flex"><LockKeyhole className="size-4" />答案仅用于匹配，不会公开展示</div><Button asChild variant="ghost" size="sm"><a href={signOutPath} target="_top"><LogOut className="mr-2 size-4" />退出</a></Button></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-10">
        <aside className="h-fit rounded-[24px] bg-[#202b2b] p-5 text-white lg:sticky lg:top-6">
          <div className="mb-6"><p className="text-xs uppercase tracking-[.18em] text-white/55">高校认证与匹配偏好</p><h1 className="mt-2 text-xl font-semibold">准备加入对话与匹配</h1><p className="mt-2 text-sm leading-6 text-white/65">可以分次完成。资料草稿保存在当前设备，匹配问卷自动同步到账号。完成后会回到刚才的话题。</p><Link href="/community" className="mt-4 inline-flex text-xs text-white/85 underline underline-offset-4">先继续浏览社区</Link></div>
          <Progress value={progress} className="mb-2 h-2 bg-white/10 [&>div]:bg-[#adc49c]" /><div className="mb-6 flex justify-between text-xs text-white/55"><span>{progress}%</span><span>{answeredCount} / {allQuestions.length} 题</span></div>
          <nav className="grid grid-cols-2 gap-1 lg:grid-cols-1">{navItems.map((item, index) => {
            const isCompleteStep = index === completeStep;
            const done = index === 0 ? campusVerified : index === 1 ? profileReady : isCompleteStep ? questionnaireCompleted : questionSections[index - 2].questions.every((question) => Boolean(answers[question.id]));
            const available = isCompleteStep ? questionnaireCompleted : index === 0 || index === 1 ? campusVerified || index === 0 : profileReady;
            const active = step === index;
            return <button type="button" key={item} onClick={() => { if (available) { setStep(index); window.scrollTo({ top: 0, behavior: "smooth" }); } }} disabled={!available} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-white text-[#202b2b]" : available ? "text-white/80 hover:bg-white/10" : "cursor-default text-white/35"}`}><span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${active ? "bg-[#a66d52] text-white" : done ? "bg-[#5b8975] text-white" : "border border-white/20"}`}>{done && !active ? <Check className="size-3.5" /> : index + 1}</span>{item}</button>;
          })}</nav>
        </aside>

        <section className="min-w-0">
          <div className="onboarding-save-note"><span>{saveStatus || "资料草稿会保存在当前设备；验证码不保存。"}</span>{saveStatus.includes("未同步") && <button type="button" onClick={() => setSaveRetry((value) => value + 1)}>重试保存</button>}{verificationStatus === "pending" && <button type="button" onClick={() => window.location.reload()}>刷新认证结果</button>}</div>
          {step === 0 && <EmailStep email={email} setEmail={setEmail} code={code} setCode={setCode} codeSent={codeSent} demoCode={demoCode} busy={busy} sendCode={sendCode} verifyCode={verifyCode} method={verificationMethod} setMethod={setVerificationMethod} university={university} setUniversity={setUniversity} identifier={verificationIdentifier} setIdentifier={setVerificationIdentifier} note={verificationNote} setNote={setVerificationNote} status={verificationStatus} submitManual={submitManualVerification} />}
          {step === 1 && <ProfileStep profile={profile} updateProfile={updateProfile} busy={busy} onSave={saveBasicProfile} />}
          {step >= 2 && step <= lastQuestionStep && <QuestionStep step={step} answers={answers} setAnswers={setAnswers} busy={busy} onSave={saveSection} onBack={() => setStep(step - 1)} />}
          {step === completeStep && <CompleteStep returnTo={returnTo} onEdit={() => setStep(1)} onEditQuestionnaire={() => setStep(2)} />}
        </section>
      </div>
    </main>
  );
}

function CardShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <div className="rounded-[28px] border border-[#e3e9e3] bg-white p-5 shadow-[0_16px_50px_rgba(23,36,31,.05)] sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#6e6e73]">{eyebrow}</p><h2 className="mt-3 font-sans text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2><p className="mt-2 max-w-2xl leading-7 text-slate-500">{description}</p><div className="mt-8">{children}</div></div>;
}

type VerificationMethod = "campus_email" | "chsi_code" | "student_card";
type EmailStepProps = { email: string; setEmail: (v: string) => void; code: string; setCode: (v: string) => void; codeSent: boolean; demoCode: string; busy: boolean; sendCode: () => void; verifyCode: () => void; method: VerificationMethod; setMethod: (v: VerificationMethod) => void; university: string; setUniversity: (v: string) => void; identifier: string; setIdentifier: (v: string) => void; note: string; setNote: (v: string) => void; status: string; submitManual: () => void };

function EmailStep(props: EmailStepProps) {
  const methods = [
    { id: "campus_email" as const, icon: <Mail />, title: "高校官方邮箱", text: "验证码自动通过，推荐" },
    { id: "chsi_code" as const, icon: <GraduationCap />, title: "学信网验证码", text: "提交后由后台审核" },
    { id: "student_card" as const, icon: <IdCard />, title: "学生证人工认证", text: "适合没有校园邮箱" },
  ];
  return <CardShell eyebrow="第 1 步 · 高校身份" title="选择最方便的学生认证方式" description="面向全国高校，不再限定某一所学校。认证信息仅用于核验，不会展示给匹配对象。">
    <div className="grid gap-3 sm:grid-cols-3">{methods.map((item) => <button key={item.id} type="button" onClick={() => props.setMethod(item.id)} className={`rounded-2xl border p-4 text-left transition ${props.method === item.id ? "border-[#286451] bg-[#edf3e9] ring-2 ring-[#286451]/10" : "border-[#e3e9e3] bg-white hover:border-[#8ca780]"}`}><span className="text-[#286451] [&>svg]:size-5">{item.icon}</span><strong className="mt-3 block text-sm">{item.title}</strong><small className="mt-1 block text-[#6e6e73]">{item.text}</small></button>)}</div>
    {props.status === "pending" && <div className="mt-6 flex gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><FileCheck2 className="size-5 shrink-0" /><div><strong>认证申请审核中</strong><p className="mt-1 text-amber-800">管理员通过后即可继续；也可以切换到高校邮箱即时验证。</p></div></div>}
    <div className="mt-7 max-w-2xl space-y-5"><div><label className="mb-2 block text-sm font-medium">学校名称</label><Input value={props.university} onChange={(e) => props.setUniversity(e.target.value)} placeholder="例如：北京大学" className="h-11" /></div>
      {props.method === "campus_email" ? <>
        <div><label className="mb-2 block text-sm font-medium">高校官方邮箱</label><div className="flex flex-col gap-3 sm:flex-row"><Input type="email" value={props.email} onChange={(e) => props.setEmail(e.target.value)} placeholder="name@university.edu.cn" className="h-11" /><Button variant="outline" onClick={props.sendCode} disabled={props.busy || !props.email || !props.university}>{props.codeSent ? "重新获取" : "获取验证码"}</Button></div><p className="mt-2 text-xs text-[#858c9e]">支持以 .edu.cn、.edu 或 .ac.cn 结尾的学校官方域名。</p></div>
        {props.codeSent && props.demoCode && <div className="rounded-xl border border-[#d8d2ff] bg-[#f4f2ff] p-4 text-sm text-[#4333a7]"><strong>演示验证码：{props.demoCode}</strong><p className="mt-1 text-[#6d61b4]">当前发信服务未配置，验证码随机生成并在 10 分钟内有效。</p></div>}
        {props.codeSent && !props.demoCode && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><strong>验证码已发送</strong><p className="mt-1">请查看学校邮箱收件箱和垃圾邮件目录。</p></div>}
        <div><label className="mb-2 block text-sm font-medium">6 位验证码</label><Input value={props.code} onChange={(e) => props.setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="请输入验证码" className="h-11 max-w-xs tracking-[.35em]" /></div>
        <Button size="lg" onClick={props.verifyCode} disabled={props.busy || props.code.length !== 6 || !props.university} className="rounded-full bg-[#286451] hover:bg-[#205340]">{props.busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Mail className="mr-2 size-4" />}验证并继续</Button>
      </> : <>
        <div><label className="mb-2 block text-sm font-medium">{props.method === "chsi_code" ? "学信网在线验证码" : "学生证信息"}</label><Input value={props.identifier} onChange={(e) => props.setIdentifier(e.target.value)} placeholder={props.method === "chsi_code" ? "填写在线验证报告验证码" : "填写学号后四位与有效期，例如 2048 / 2027-06"} className="h-11" /></div>
        <div><label className="mb-2 block text-sm font-medium">补充说明（可选）</label><Textarea value={props.note} onChange={(e) => props.setNote(e.target.value)} placeholder={props.method === "student_card" ? "请说明院系、当前年级；图片上传能力将在下一版接入" : "可补充院系或报告有效期"} className="min-h-24" /></div>
        <Button size="lg" onClick={props.submitManual} disabled={props.busy || props.identifier.trim().length < 4 || props.university.trim().length < 2} className="rounded-full bg-[#286451] hover:bg-[#205340]">{props.busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileCheck2 className="mr-2 size-4" />}提交人工审核</Button>
      </>}
      <div className="flex gap-3 border-t border-[#e6e7ee] pt-5 text-sm text-[#68708a]"><ShieldCheck className="size-5 shrink-0 text-[#2f8a69]" /><p>每个认证凭据仅可绑定一个账号。当前版本不采集身份证号，也不会向其他用户展示学校邮箱或学号。</p></div>
    </div>
  </CardShell>;
}

function ProfileStep({ profile, updateProfile, busy, onSave }: { profile: Record<string, string>; updateProfile: (key: string, value: string) => void; busy: boolean; onSave: () => void }) {
  const [uploading, setUploading] = useState(false);

  async function uploadPhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const result = await response.json() as { ok: boolean; data?: { url: string }; error?: string };
      if (!response.ok || !result.ok || !result.data) throw new Error(result.error || "上传失败");
      updateProfile("photoUrl", result.data.url);
      toast.success("头像已上传并保存");
    } catch (error) { toast.error(error instanceof Error ? error.message : "上传失败"); }
    finally { setUploading(false); }
  }

  return <CardShell eyebrow="第 2 步 · 基本资料" title="给未来的相遇一点轮廓" description="请如实填写。除昵称与选择公开的信息外，敏感资料不会直接展示。">
    <div className="mb-7 flex flex-col gap-4 rounded-2xl border border-[#e3e9e3] bg-[#f6f7f5] p-4 sm:flex-row sm:items-center"><div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-[#edf2ee] text-[#286451]">{profile.photoUrl ? <Image src={profile.photoUrl} alt="个人头像" fill sizes="80px" className="object-cover" /> : <Camera className="size-7" />}</div><div className="flex-1"><strong className="block">个人头像</strong><p className="mt-1 text-sm text-[#6e6e73]">支持 JPG、PNG 或 WebP，最大 5MB。</p></div><label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-full border border-[#d6d6da] bg-white px-4 text-sm font-medium hover:border-[#286451]"><input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={(event) => void uploadPhoto(event.target.files?.[0])} />{uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Camera className="mr-2 size-4" />}{uploading ? "上传中" : "选择图片"}</label></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="昵称" value={profile.nickname} onChange={(v) => updateProfile("nickname", v.slice(0, 20))} placeholder="匹配对象将看到这个名字" />
      <SelectField label="性别" value={profile.gender} onChange={(v) => updateProfile("gender", v)} options={["男生", "女生"]} />
      <SelectField label="年级" value={profile.grade} onChange={(v) => updateProfile("grade", v)} options={["大一", "大二", "大三", "大四", "研一", "研二", "研三", "博士生"]} />
      <Field label="专业" value={profile.major} onChange={(v) => updateProfile("major", v)} placeholder="例如：电气工程" />
      <Field label="所在校区" value={profile.campus} onChange={(v) => updateProfile("campus", v)} placeholder="例如：闵行校区（可选）" />
      <Field label="家乡" value={profile.hometown} onChange={(v) => updateProfile("hometown", v)} placeholder="例如：河北石家庄" />
      <Field label="身高（cm）" value={profile.height} onChange={(v) => updateProfile("height", v.replace(/\D/g, "").slice(0, 3))} placeholder="可选" />
      <SelectField label="吸烟情况" value={profile.smoking} onChange={(v) => updateProfile("smoking", v)} options={["不吸烟", "偶尔", "经常", "不便说明"]} />
      <SelectField label="关系期待" value={profile.lookingFor} onChange={(v) => updateProfile("lookingFor", v)} options={["relationship|稳定恋爱", "friends-first|先从朋友开始", "open|顺其自然"]} parse />
      <div className="sm:col-span-2"><label className="mb-2 block text-sm font-medium">兴趣标签</label><Input value={profile.interests} onChange={(e) => updateProfile("interests", e.target.value)} placeholder="摄影，跑步，电影，旅行（用逗号分隔）" className="h-11" /></div>
      <div className="sm:col-span-2"><label className="mb-2 block text-sm font-medium">自我介绍</label><Textarea value={profile.bio} onChange={(e) => updateProfile("bio", e.target.value)} placeholder="聊聊你的日常、在意的事情，或期待怎样的关系…" className="min-h-32" maxLength={300} /><p className="mt-1 text-right text-xs text-slate-400">{profile.bio.length} / 300</p></div>
    </div><div className="mt-7 flex justify-end"><Button size="lg" onClick={onSave} disabled={busy} className="bg-[#286451] hover:bg-[#205340]">保存并填写 20 题匹配偏好 <ArrowRight className="ml-2 size-4" /></Button></div>
  </CardShell>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <div><label className="mb-2 block text-sm font-medium">{label}</label><Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-11" /></div>;
}

function SelectField({ label, value, onChange, options, parse = false }: { label: string; value: string; onChange: (v: string) => void; options: string[]; parse?: boolean }) {
  return <div><label className="mb-2 block text-sm font-medium">{label}</label><select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">请选择</option>{options.map((option) => { const [key, text] = parse ? option.split("|") : [option, option]; return <option key={key} value={key}>{text}</option>; })}</select></div>;
}

function QuestionStep({ step, answers, setAnswers, busy, onSave, onBack }: { step: number; answers: Record<string, number>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, number>>>; busy: boolean; onSave: () => void; onBack: () => void }) {
  const section = questionSections[step - 2];
  const complete = section.questions.filter((question) => answers[question.id]).length;
  return <CardShell eyebrow={`匹配偏好 ${step - 1} / ${questionSections.length} · ${complete} / ${section.questions.length} 已答`} title={section.title} description={section.subtitle + "。选择更接近真实情况的一项，没有标准答案。"}>
    <div className="space-y-5">{section.questions.map((question, index) => <article id={question.id} key={question.id} className="scroll-mt-24 rounded-2xl border border-[#e1e8f0] bg-[#fbfcfe] p-4 sm:p-5"><div className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#e8eef7] text-xs font-semibold text-[#294767]">{index + 1}</span><p className="pt-0.5 font-medium leading-6">{question.text}</p></div><div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">{scaleLabels.map((label, optionIndex) => { const value = optionIndex + 1; const selected = answers[question.id] === value; return <button key={label} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))} className={`min-h-14 rounded-xl border px-1 py-2 text-[11px] leading-4 transition sm:text-xs ${selected ? "border-[#ff665b] bg-[#fff0ee] font-semibold text-[#c44239] ring-2 ring-[#ff665b]/10" : "border-[#dfe7f1] bg-white text-slate-500 hover:border-[#9fb1c8]"}`}><span className={`mx-auto mb-1 grid size-5 place-items-center rounded-full border ${selected ? "border-[#ff665b] bg-[#286451] text-white" : "border-[#becada]"}`}>{selected && <Check className="size-3" />}</span>{label}</button>; })}</div></article>)}</div>
    <div className="mt-7 flex items-center justify-between border-t border-[#e6edf4] pt-6"><Button variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 size-4" />上一步</Button><div className="flex items-center gap-3"><span className="hidden text-xs text-slate-400 sm:block">回答会自动保留在当前页面</span><Button size="lg" onClick={onSave} disabled={busy} className="bg-[#286451] hover:bg-[#205340]">{busy && <Loader2 className="mr-2 size-4 animate-spin" />}{step === questionSections.length + 1 ? "完成并进入社区" : "保存并继续"}<ArrowRight className="ml-2 size-4" /></Button></div></div>
  </CardShell>;
}

function CompleteStep({ onEdit, onEditQuestionnaire, returnTo }: { onEdit: () => void; onEditQuestionnaire: () => void; returnTo: string }) {
  return <div className="overflow-hidden rounded-[24px] border border-[#e3e9e3] bg-white text-center shadow-[0_12px_36px_rgba(23,36,31,.05)]"><div className="bg-[#202b2b] px-6 py-12 text-white"><span className="mx-auto grid size-14 place-items-center rounded-full bg-white/10"><Sparkles className="size-7" /></span><Badge className="mt-6 bg-white/10 text-white">{allQuestions.length} / {allQuestions.length} 已完成</Badge><h2 className="mt-4 text-3xl font-semibold">可以加入对话与匹配了</h2><p className="mx-auto mt-3 max-w-xl leading-7 text-white/70">你的 MBTI 结果、资料和 5 组相处偏好会共同参与推荐。问卷已经保存，之后可以随时回来修改。</p></div><div className="p-7 sm:p-10"><div className="mx-auto grid max-w-2xl gap-3 sm:grid-cols-3"><CompleteItem icon={<BadgeCheck />} title="高校身份" text="已验证" /><CompleteItem icon={<Check />} title="基本资料" text="已保存" /><CompleteItem icon={<Heart />} title="匹配偏好" text="已生成" /></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg" className="bg-[#286451] hover:bg-[#205340]"><a href={returnTo} target="_top">回到刚才的页面 <ArrowRight className="ml-2 size-4" /></a></Button><Button type="button" size="lg" variant="outline" onClick={onEdit}>修改个人资料</Button><Button type="button" size="lg" variant="ghost" onClick={onEditQuestionnaire}>修改匹配偏好</Button></div></div></div>;
}

function CompleteItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-2xl bg-[#f5f8fc] p-4 text-left"><span className="text-[#2f8a69] [&>svg]:size-5">{icon}</span><strong className="mt-3 block text-sm">{title}</strong><small className="text-slate-500">{text}</small></div>;
}
