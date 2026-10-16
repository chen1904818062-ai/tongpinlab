"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { PremiumHeader } from "@/components/premium-header";
import { PersonalityIntro } from "@/components/personality-intro";
import { ArrowLeft, ArrowRight, LockKeyhole, RotateCcw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type MbtiDimension = "energy" | "information" | "decision" | "rhythm";
type RelationshipDimension = "connection" | "expression" | "conflict" | "exploration";
type Answer = -2 | -1 | 0 | 1 | 2;
type Question = { text: string; scene: string; left: string; right: string; mbti?: MbtiDimension; relationship?: RelationshipDimension };
type TypeProfile = { name: string; summary: string; traits: string[]; social: string; recharge: string; match: string };
type ResultArtwork = { src: string; group: string; caption: string };

const questions: Question[] = [
  { scene: "新学期", text: "第一次参加社团破冰，你通常会——", mbti: "energy", left: "先观察氛围，等别人来聊", right: "主动开口，很快认识一圈人" },
  { scene: "开放作业", text: "拿到一份没有标准答案的作业时，你更倾向——", mbti: "information", left: "先找案例和明确要求", right: "先构思一个特别的方向" },
  { scene: "朋友求助", text: "朋友因为小组合作受了委屈，你会先——", mbti: "decision", left: "帮他梳理问题和解决办法", right: "先接住情绪，让他被理解" },
  { scene: "周末安排", text: "面对一个完全空白的周末，你更喜欢——", mbti: "rhythm", left: "提前约好地点和时间", right: "睡醒再看心情决定" },
  { scene: "食堂偶遇", text: "看到只见过几次的同学独自吃饭，你会——", mbti: "energy", left: "点头打招呼，各自吃饭", right: "自然拼桌，顺便聊起来" },
  { scene: "课堂讨论", text: "讨论一件新事物时，什么更容易吸引你？", mbti: "information", left: "它现在如何运作、是否实用", right: "它未来可能变成什么" },
  { scene: "发生分歧", text: "你认为一次好的争论应该——", mbti: "decision", left: "把事实和逻辑讲清楚", right: "兼顾表达方式和彼此感受" },
  { scene: "旅行计划", text: "和同学去周边旅行，你更安心的状态是——", mbti: "rhythm", left: "路线住宿都提前确认", right: "只定大方向，沿途再探索" },
  { scene: "校园活动", text: "参加一场大型校园活动后，你通常——", mbti: "energy", left: "需要独处一会儿恢复精力", right: "仍然兴奋，想继续续摊" },
  { scene: "认识新人", text: "你更容易记住一个人的——", mbti: "information", left: "说过的具体事情和细节", right: "整体气质和带来的感觉" },
  { scene: "团队决策", text: "团队需要淘汰一个创意时，你通常支持——", mbti: "decision", left: "效果最好、最可执行的方案", right: "最能照顾成员投入的方案" },
  { scene: "截止日期", text: "一项任务还有两周截止，你更可能——", mbti: "rhythm", left: "拆成几步，陆续做完", right: "先酝酿，临近截止集中完成" },
  { scene: "陌生环境", text: "独自去一个新城市交换学习，你会——", mbti: "energy", left: "先建立少数稳定关系", right: "尽量参加活动扩大朋友圈" },
  { scene: "选课", text: "选择通识课时，你更看重——", mbti: "information", left: "内容清晰、评价稳定", right: "观点新鲜、能打开想象力" },
  { scene: "收到批评", text: "面对直接的负面反馈，你最先关注——", mbti: "decision", left: "对方说得是否有道理", right: "对方为什么用这种方式说" },
  { scene: "临时邀约", text: "朋友在出发前半小时邀你看演出，你会——", mbti: "rhythm", left: "大概率拒绝，原计划被打乱", right: "只要有趣就马上出门" },
  { scene: "课间十分钟", text: "没有熟人在身边时，你通常会——", mbti: "energy", left: "享受安静，做自己的事", right: "找机会和周围的人聊天" },
  { scene: "解决问题", text: "复杂问题卡住时，你更信任——", mbti: "information", left: "过去验证过的方法", right: "突然出现的新联想" },
  { scene: "礼物选择", text: "给朋友挑生日礼物时，你更在意——", mbti: "decision", left: "是否实用、是否真正需要", right: "是否承载你们之间的故事" },
  { scene: "日常生活", text: "哪种状态更接近你？", mbti: "rhythm", left: "事情有序会让我放松", right: "保留变化会让我有活力" },
  { scene: "新群聊", text: "一个新群聊开始热闹起来，你通常——", mbti: "energy", left: "先潜水，熟悉后再发言", right: "很快加入，接住大家的话题" },
  { scene: "看完电影", text: "你更常和朋友讨论——", mbti: "information", left: "情节、表演和具体镜头", right: "隐喻、主题和另一种解读" },
  { scene: "朋友选择", text: "朋友在理想和现实之间犹豫，你更可能说——", mbti: "decision", left: "把成本收益列出来再决定", right: "想想哪条路让你更像自己" },
  { scene: "计划变化", text: "原本的安排突然取消时，你更接近——", mbti: "rhythm", left: "有点烦，需要重新安排", right: "没关系，正好换个玩法" },
  { scene: "关系日常", text: "和喜欢的人相处时，哪种节奏更舒服？", relationship: "connection", left: "彼此有空间，重要时再联系", right: "经常分享日常，保持稳定互动" },
  { scene: "忙碌的一天", text: "课程和任务都很满时，你更希望对方——", relationship: "connection", left: "理解我暂时安静，不必频繁确认", right: "哪怕简短，也保持一些联系" },
  { scene: "表达喜欢", text: "你通常更自然地用哪种方式表达在意？", relationship: "expression", left: "记住细节，用行动照顾", right: "直接说出来，及时给出回应" },
  { scene: "需要支持", text: "自己状态不太好时，你更可能——", relationship: "expression", left: "先自己消化，等合适时再说", right: "主动告诉信任的人我需要陪伴" },
  { scene: "意见不合", text: "发生让你不舒服的分歧后，你更需要——", relationship: "conflict", left: "先安静一下，整理好再沟通", right: "尽快说开，避免问题悬着" },
  { scene: "消息误会", text: "一段文字让你感觉被冒犯，你会倾向——", relationship: "conflict", left: "等情绪平稳后再确认意思", right: "当下问清楚，不让猜测继续" },
  { scene: "共同生活", text: "一段关系里，你更珍惜——", relationship: "exploration", left: "熟悉稳定、可以依靠的日常", right: "不断尝试、一起发现新体验" },
  { scene: "约会选择", text: "如果由你决定一次见面，你更可能选——", relationship: "exploration", left: "去熟悉舒服的地方好好聊天", right: "尝试没去过的新店或新活动" },
];

const profiles: Record<string, TypeProfile> = {
  ISTJ: { name: "稳健执行者", summary: "你安静、可靠，习惯把复杂生活整理成可以落地的步骤。", traits: ["可靠", "细致", "有秩序"], social: "慢热但稳定，更相信经得起时间的关系。", recharge: "独处、整理空间，或完成一件明确的小事。", match: "尊重承诺，也愿意为生活加入一点新鲜感的人。" },
  ISTP: { name: "冷静实践者", summary: "你好奇、独立，喜欢亲手弄明白事物是怎样运转的。", traits: ["冷静", "务实", "边界清晰"], social: "不爱过度表达，但会用行动回应真正重要的人。", recharge: "研究兴趣、运动，或短暂离开人群。", match: "尊重彼此空间、沟通直接又不过度黏连的人。" },
  ISFJ: { name: "温和守护者", summary: "你细致、体贴，总能发现别人没有说出口的需要。", traits: ["体贴", "耐心", "重承诺"], social: "重视安全感，会默默记住朋友的习惯和约定。", recharge: "熟悉的环境、稳定的陪伴和安静时间。", match: "珍惜你的付出，也愿意主动给你确定感的人。" },
  ISFP: { name: "自在感受者", summary: "你温和、自由，拥有自己的审美和不被打扰的内心世界。", traits: ["真实", "随和", "有审美"], social: "喜欢自然相处，不急着给关系下定义。", recharge: "音乐、散步、拍照，以及没有安排的半天。", match: "细腻真诚、能理解沉默又尊重边界的人。" },
  INFJ: { name: "深度洞察者", summary: "你擅长理解复杂情绪，也一直在寻找更深层的意义。", traits: ["洞察", "共情", "有理想"], social: "不追求认识很多人，但重视少数真正同频的连接。", recharge: "独处思考、写作，或与可信任的人深聊。", match: "真诚、有内在世界，也愿意耐心建立信任的人。" },
  INFP: { name: "理想共鸣者", summary: "你重视真实和意义，温和外表下有非常坚定的价值观。", traits: ["真诚", "想象力", "重价值"], social: "容易被精神共鸣打动，不喜欢表面化的热闹。", recharge: "故事、音乐、创作和允许自己发呆的时间。", match: "尊重你的理想，也能温和推动彼此行动的人。" },
  INTJ: { name: "远景规划者", summary: "你习惯从长期视角思考，喜欢把复杂目标变成自己的系统。", traits: ["独立", "有策略", "高标准"], social: "筛选关系很谨慎，一旦认定就会认真投入。", recharge: "独立推进计划，沉浸在有挑战的问题里。", match: "有想法、有执行力，并尊重你思考节奏的人。" },
  INTP: { name: "好奇研究者", summary: "你的大脑喜欢连接新知识，也常从意想不到的角度看问题。", traits: ["好奇", "理性", "开放"], social: "比起寒暄，更喜欢围绕有趣问题聊到很深。", recharge: "自由探索、不被催促，以及突然想通一件事。", match: "能接住冷门话题，也理解你偶尔安静的人。" },
  ESTJ: { name: "清晰推动者", summary: "你果断、清晰，擅长让团队从讨论快速走向行动。", traits: ["直接", "负责", "执行力强"], social: "喜欢可靠、说到做到的人，也愿意承担关系责任。", recharge: "推进进度、解决难题，看到事情真正发生。", match: "坦率靠谱、愿意一起规划和成长的人。" },
  ESTP: { name: "现场行动者", summary: "你反应快、敢尝试，总能在现场找到最有意思的入口。", traits: ["机敏", "大胆", "体验导向"], social: "通过一起做事建立关系，不喜欢拐弯抹角。", recharge: "运动、出门、临时起意的体验和新挑战。", match: "爽快独立，既能一起探索也懂得适时停下来的人。" },
  ESFJ: { name: "关系连接者", summary: "你关注关系温度，擅长让身边的人感到自己被看见。", traits: ["热心", "会照顾人", "善组织"], social: "在互动中获得能量，也看重回应和仪式感。", recharge: "和喜欢的人见面，策划一次大家都舒服的活动。", match: "愿意表达、重视回应，也会照顾你感受的人。" },
  ESFP: { name: "当下体验者", summary: "你善于捕捉当下的快乐，也愿意把能量分享给身边的人。", traits: ["热情", "松弛", "有感染力"], social: "喜欢自然有趣的互动，关系里不喜欢敷衍。", recharge: "好吃的、好玩的，以及让你能做自己的人。", match: "真诚、有趣，既能热闹也能认真倾听的人。" },
  ENFJ: { name: "成长陪伴者", summary: "你擅长发现人的潜力，也常自然地成为关系中的连接者。", traits: ["共情", "有号召力", "重成长"], social: "重视精神交流，也愿意主动经营一段关系。", recharge: "帮助别人取得进展，或进行一次真诚的对话。", match: "有自己的方向，同时愿意与你互相支持的人。" },
  ENFP: { name: "灵感连接者", summary: "你热情、好奇，很容易从新人、新事和新可能中获得能量。", traits: ["创造力", "真性情", "有感染力"], social: "喜欢有火花的连接，希望对方既有趣又有深度。", recharge: "新鲜体验、自由表达，以及突然冒出的好点子。", match: "能回应你的热情，也能给关系带来稳定感的人。" },
  ENTJ: { name: "目标引领者", summary: "你目标明确、行动迅速，习惯带着身边的人一起向前。", traits: ["高效", "自信", "有领导力"], social: "欣赏独立和能力，也重视彼此能否共同成长。", recharge: "攻克目标、推动改变，和有想法的人交换观点。", match: "自信坦诚、有边界，也敢于挑战你的人。" },
  ENTP: { name: "观点探索者", summary: "你享受观点碰撞，擅长把看似无关的东西组合成新思路。", traits: ["创新", "反应快", "思维开放"], social: "对能聊、敢想、有自己观点的人格外感兴趣。", recharge: "新问题、新朋友和一场没有标准答案的讨论。", match: "思维开放、情绪稳定，愿意与你来回讨论的人。" },
};

const campusQuips: Record<string, string> = {
  ISTJ: "群里刚问“谁来统计一下”，你已经把表格列名建好了。",
  ISTP: "宿舍东西一坏，大家会先安静地看你一眼。",
  ISFJ: "记得同学不喝冰，也记得提醒大家明天带伞。",
  ISFP: "不一定抢着说话，但总能找到校园里最好看的那条路。",
  INFJ: "原本只散步十分钟，最后聊到了毕业以后想过怎样的生活。",
  INFP: "歌单还没分享，已经替这段友谊想好了封面。",
  INTJ: "别人约周末，你顺手做了三套路线和一份雨天预案。",
  INTP: "本来只想查一道题，回过神已经打开十二个标签页。",
  ESTJ: "群里还在讨论时间，你已经订好场地并发出集合点。",
  ESTP: "临时活动？五分钟后你已经在路上，还顺手叫上了两个人。",
  ESFJ: "聚餐还没开始，座位、忌口和谁没回消息都安排明白了。",
  ESFP: "只是路过操场，也可能顺手认识一队新朋友。",
  ENFJ: "社团新人一句话没说，你已经看出他有点紧张。",
  ENFP: "去食堂吃顿饭，回来多了两个新朋友和一个周末计划。",
  ENTJ: "第一次见面就聊清目标，但也会记住对方的奶茶口味。",
  ENTP: "讨论从选课开始，最后差点在食堂成立一个新社团。",
};

function resultArtwork(code: string): ResultArtwork {
  if (code[1] === "N" && code[2] === "T") return { src: "/personality/result-analyst-v2.webp", group: "分析家 · 泡面实验室", caption: "把简单问题研究得很完整，也算一种校园浪漫。" };
  if (code[1] === "N" && code[2] === "F") return { src: "/personality/result-diplomat-v2.webp", group: "理想主义者 · 朋友应急包", caption: "包里装的不只是东西，还有对周围人的留意。" };
  if (code[1] === "S" && code[3] === "J") return { src: "/personality/result-sentinel-v2.webp", group: "守护者 · 社团后勤部", caption: "靠谱不是口号，是胶带、清单和备用方案。" };
  return { src: "/personality/result-explorer-v2.webp", group: "探索者 · 临时出发", caption: "计划可以晚一点，精彩的现场不能错过。" };
}

const mbtiMeta: Record<MbtiDimension, { left: string; right: string; leftCode: string; rightCode: string; title: string }> = {
  energy: { left: "独处回血", right: "人群充电", leftCode: "I", rightCode: "E", title: "能量来源" },
  information: { left: "关注事实", right: "联想可能", leftCode: "S", rightCode: "N", title: "信息偏好" },
  decision: { left: "逻辑权衡", right: "感受权衡", leftCode: "T", rightCode: "F", title: "决策方式" },
  rhythm: { left: "偏好确定", right: "保留弹性", leftCode: "J", rightCode: "P", title: "生活节奏" },
};

const relationshipMeta: Record<RelationshipDimension, { left: string; right: string; title: string }> = {
  connection: { left: "独立留白", right: "稳定陪伴", title: "连接频率" },
  expression: { left: "行动表达", right: "直接表达", title: "情感表达" },
  conflict: { left: "冷静后谈", right: "及时说开", title: "分歧处理" },
  exploration: { left: "熟悉安稳", right: "共同探索", title: "关系体验" },
};

const scale: { value: Answer; label: string }[] = [
  { value: -2, label: "很像左边" }, { value: -1, label: "比较像左边" }, { value: 0, label: "两边都像" }, { value: 1, label: "比较像右边" }, { value: 2, label: "很像右边" },
];
const progressStorageKey = "campus-personality-v2";
const resultStorageKey = "campus-personality-result-v1";

export function PersonalityTest({ initialMode = "intro" }: { initialMode?: "intro" | "quiz" }) {
  const router = useRouter();
  const [answers, setAnswers] = useState<(Answer | null)[]>(() => Array(questions.length).fill(null));
  const [current, setCurrent] = useState(0);
  const [mode, setMode] = useState<"intro" | "quiz" | "result">(initialMode);
  const [sharedType, setSharedType] = useState<string | null>(null);
  const [sharedRelationship, setSharedRelationship] = useState<Record<RelationshipDimension, number> | null>(null);
  const [restored, setRestored] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setStorageReady(true));
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("type")?.toUpperCase();
    if (shared && profiles[shared]) {
      const raw = params.get("r")?.split(",").map(Number);
      const keys = Object.keys(relationshipMeta) as RelationshipDimension[];
      const parsed = raw?.length === keys.length && raw.every(Number.isFinite)
        ? Object.fromEntries(keys.map((key, index) => [key, Math.max(-4, Math.min(4, raw[index]))])) as Record<RelationshipDimension, number>
        : null;
      queueMicrotask(() => { setSharedType(shared); setSharedRelationship(parsed); setMode("result"); });
      return;
    }
    const saved = window.localStorage.getItem(progressStorageKey);
    if (!saved) return;
    try {
      const value = JSON.parse(saved) as { answers: (Answer | null)[]; current: number; mode: "intro" | "quiz" | "result" };
      if (Array.isArray(value.answers) && value.answers.length === questions.length) {
        queueMicrotask(() => {
          setAnswers(value.answers);
          setCurrent(Math.min(value.current || 0, questions.length - 1));
          setMode(initialMode === "intro" ? "intro" : value.answers.every((item) => item !== null) ? "result" : "quiz");
          setRestored(value.answers.some((item) => item !== null));
        });
      }
    } catch { window.localStorage.removeItem(progressStorageKey); }
  }, [initialMode]);

  useEffect(() => {
    if (!storageReady || sharedType) return;
    if (mode !== "intro" || answers.some((item) => item !== null)) window.localStorage.setItem(progressStorageKey, JSON.stringify({ answers, current, mode }));
  }, [answers, current, mode, storageReady, sharedType]);

  const mbtiScores = useMemo(() => {
    const value: Record<MbtiDimension, number> = { energy: 0, information: 0, decision: 0, rhythm: 0 };
    questions.forEach((question, index) => { if (question.mbti) value[question.mbti] += answers[index] ?? 0; });
    return value;
  }, [answers]);
  const relationshipScores = useMemo(() => {
    const value: Record<RelationshipDimension, number> = { connection: 0, expression: 0, conflict: 0, exploration: 0 };
    questions.forEach((question, index) => { if (question.relationship) value[question.relationship] += answers[index] ?? 0; });
    return value;
  }, [answers]);
  const resultCode = sharedType || (Object.keys(mbtiMeta) as MbtiDimension[]).map((key) => mbtiScores[key] > 0 ? mbtiMeta[key].rightCode : mbtiMeta[key].leftCode).join("");
  const finalRelationshipScores = sharedRelationship || relationshipScores;
  const answeredCount = answers.filter((item) => item !== null).length;

  useEffect(() => {
    if (mode !== "result" || sharedType || answeredCount !== questions.length) return;
    window.localStorage.setItem(resultStorageKey, JSON.stringify({ type: resultCode, scores: mbtiScores, traits: relationshipScores, completedAt: new Date().toISOString() }));
  }, [mode, sharedType, answeredCount, resultCode, mbtiScores, relationshipScores]);

  function start() { router.push("/test"); }
  function goHome() { setMode("intro"); setSharedType(null); setSharedRelationship(null); }
  function answer(value: Answer) { const next = [...answers]; next[current] = value; setAnswers(next); window.setTimeout(() => { if (current === questions.length - 1) setMode("result"); else setCurrent(current + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }, 120); }
  function restart() { setAnswers(Array(questions.length).fill(null)); setCurrent(0); setSharedType(null); setSharedRelationship(null); setMode("quiz"); window.history.replaceState({}, "", "/test"); window.localStorage.removeItem(progressStorageKey); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function share() {
    const relationValues = (Object.keys(relationshipMeta) as RelationshipDimension[]).map((key) => finalRelationshipScores[key]).join(",");
    const url = `${window.location.origin}/test?type=${resultCode.toLowerCase()}&r=${encodeURIComponent(relationValues)}`;
    const text = `我的 MBTI 倾向是 ${resultCode}，关系性格是「${relationshipLabel(finalRelationshipScores)}」。来看看我们有哪些相似和不同：`;
    try { if (navigator.share) await navigator.share({ title: `${resultCode} · ${profiles[resultCode].name}`, text, url }); else { await navigator.clipboard.writeText(`${text}${url}`); toast.success("分享内容已复制"); } }
    catch (error) { if (error instanceof Error && error.name !== "AbortError") toast.error("分享失败，请稍后重试"); }
  }

  return <main className="personality-app min-h-screen overflow-hidden">
    <PremiumHeader home={mode === "intro"} onHome={goHome} />
    {mode === "intro" && <PersonalityIntro restored={restored} answeredCount={answeredCount} onStart={start} />}
    {mode === "quiz" && <Quiz current={current} answers={answers} onAnswer={answer} onBack={() => setCurrent(Math.max(0, current - 1))} onGo={setCurrent} />}
    {mode === "result" && <Result code={resultCode} scores={mbtiScores} relationshipScores={finalRelationshipScores} shared={Boolean(sharedType)} onShare={share} onRestart={restart} />}
    <footer className="premium-footer"><div className="premium-footer-inner"><strong>同频实验室 · 每一种性格，都值得被理解。</strong><span>结果用于自我探索与社交破冰，不构成心理测评或诊断</span></div></footer>
  </main>;
}

function Quiz({ current, answers, onAnswer, onBack, onGo }: { current: number; answers: (Answer | null)[]; onAnswer: (value: Answer) => void; onBack: () => void; onGo: (index: number) => void }) {
  const [questionMapOpen, setQuestionMapOpen] = useState(false);
  const question = questions[current];
  const stage = question.mbti ? "MBTI 四维倾向" : "关系性格侧写";
  return <section className="premium-quiz min-h-[calc(100vh-8rem)] px-4 py-8 sm:px-6 sm:py-12"><div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[230px_minmax(0,1fr)]"><aside className="h-fit rounded-2xl border border-[#e5e5e7] bg-white p-5 lg:sticky lg:top-24"><div className="flex items-center justify-between text-sm"><strong>测试进度</strong><span className="font-semibold text-[#0071e3]">{current + 1} / {questions.length}</span></div><Progress value={((current + 1) / questions.length) * 100} className="mt-4 h-2 bg-[#ededf0] [&>div]:bg-[#0071e3]" /><p className="mt-5 text-xs font-semibold tracking-[.12em] text-[#86868b]">{stage}</p><button type="button" className="quiz-map-toggle" aria-expanded={questionMapOpen} aria-controls="quiz-question-map" onClick={() => setQuestionMapOpen((open) => !open)}>{questionMapOpen ? "收起题目导航" : "查看题目导航"}<span aria-hidden="true">{questionMapOpen ? "−" : "+"}</span></button><div id="quiz-question-map" className={`quiz-question-map mt-4 grid grid-cols-8 gap-1.5 lg:grid-cols-4 ${questionMapOpen ? "is-open" : ""}`}>{questions.map((_, index) => { const available = index <= current || answers[index] !== null; return <button key={index} type="button" disabled={!available} onClick={() => onGo(index)} aria-label={`前往第 ${index + 1} 题`} className={`grid aspect-square place-items-center rounded-md text-[11px] font-medium ${index === current ? "bg-[#1d1d1f] text-white" : answers[index] !== null ? "bg-[#e4eefc] text-[#0071e3] hover:bg-[#d2e5ff]" : "bg-[#f0f0f3] text-[#9aa09c]"}`}>{index + 1}</button>; })}</div><p className="quiz-progress-hint mt-5 text-sm leading-6 text-[#6e6e73]">已回答的题目可以随时返回修改。按第一反应选择即可。</p></aside><div className="premium-quiz-panel min-w-0 rounded-3xl border border-[#e5e5e7] bg-white p-6 sm:p-10"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-[#eff5ff] px-3 py-1.5 text-sm font-medium text-[#0071e3]">{question.scene}</span><span className="text-sm text-[#86868b]">{stage} · 第 {current + 1} 题</span></div><h1 className="mt-8 max-w-3xl font-sans text-3xl font-semibold leading-[1.35] tracking-tight sm:text-4xl">{question.text}</h1><div className="mt-9 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-[#f1f5fc] p-5 text-center font-medium text-[#34455f]">{question.left}</div><div className="rounded-2xl bg-[#f4efe8] p-5 text-center font-medium text-[#665443]">{question.right}</div></div><div className="mt-8 grid grid-cols-5 gap-2 sm:gap-3">{scale.map((item, index) => <button key={item.value} type="button" onClick={() => onAnswer(item.value)} aria-label={item.label} className={`min-h-24 rounded-2xl border p-2 transition hover:border-[#0071e3] hover:bg-[#f5f8ff] ${answers[current] === item.value ? "border-[#0071e3] bg-[#eaf2ff] ring-2 ring-[#0071e3]/10" : "border-[#e5e5e7] bg-white"}`}><span className={`mx-auto block rounded-full ${index === 2 ? "size-3 bg-[#9aa09c]" : index === 1 || index === 3 ? "size-5" : "size-7"} ${index < 2 ? "bg-[#526f80]" : index > 2 ? "bg-[#a66d52]" : ""}`} /><small className="mt-3 block text-[10px] leading-4 text-[#6e6e73] sm:text-xs">{item.label}</small></button>)}</div><div className="mt-8 flex items-center justify-between border-t border-[#ececef] pt-5"><Button type="button" variant="ghost" onClick={onBack} disabled={current === 0}><ArrowLeft className="mr-2 size-4" />上一题</Button><span className="text-sm text-[#96969c]">选择后自动进入下一题</span></div></div></div></section>;
}

function Result({ code, scores, relationshipScores, shared, onShare, onRestart }: { code: string; scores: Record<MbtiDimension, number>; relationshipScores: Record<RelationshipDimension, number>; shared: boolean; onShare: () => void; onRestart: () => void }) {
  const profile = profiles[code] || profiles.INFP;
  const artwork = resultArtwork(code);
  return <section className="premium-result px-4 py-10 sm:px-6 sm:py-16"><div className="mx-auto max-w-6xl"><div className="premium-result-summary grid overflow-hidden rounded-2xl border border-[#e5e5e7] bg-white lg:grid-cols-[.76fr_1.24fr]"><div className="premium-result-portrait flex flex-col bg-[#1d1d1f] p-7 text-white sm:p-10"><p className="text-sm font-medium tracking-[.16em] text-white/65">你的 MBTI 倾向</p><p className="mt-6 text-7xl font-semibold tracking-[-.06em] sm:text-8xl">{code}</p><h1 className="mt-5 text-2xl font-semibold">{profile.name}</h1><p className="mt-4 max-w-md leading-7 text-white/75">{profile.summary}</p><div className="mt-6 flex flex-wrap gap-2">{profile.traits.map((trait) => <span key={trait} className="rounded-md border border-white/25 px-3 py-1.5 text-sm text-white/85">{trait}</span>)}</div><div className="mt-auto pt-10"><p className="text-xs leading-5 text-white/55">MBTI 是理解偏好的语言，不是能力、价值或关系质量的结论。</p></div></div><div className="p-6 sm:p-9"><div className="grid items-center gap-5 rounded-xl border border-[#ddd6c8] bg-[#f1ede4] p-4 sm:grid-cols-[190px_1fr]"><div className="relative mx-auto aspect-square w-full max-w-[190px]"><Image src={artwork.src} alt={`${artwork.group}原创校园性格插画`} fill priority sizes="190px" className="object-contain" /></div><div><p className="text-xs font-semibold tracking-[.12em] text-[#7b6a55]">校园性格小剧场</p><h2 className="mt-2 text-lg font-semibold text-[#24362f]">{artwork.group}</h2><p className="mt-3 text-base font-medium leading-7 text-[#384b43]">“{campusQuips[code] || campusQuips.INFP}”</p><p className="mt-3 text-xs leading-5 text-[#7b766d]">{artwork.caption}</p></div></div><p className="mt-8 text-sm font-semibold text-[#0071e3]">四维倾向强度</p><div className="mt-5 space-y-6">{(Object.keys(mbtiMeta) as MbtiDimension[]).map((key) => <DimensionBar key={key} dimension={key} score={scores[key]} shared={shared} code={code} />)}</div><div className="mt-9 grid gap-3"><ResultNote label="你的社交方式" text={profile.social} /><ResultNote label="你的恢复方式" text={profile.recharge} /><ResultNote label="适合你的关系线索" text={profile.match} /></div></div></div><section className="mt-7 rounded-2xl border border-[#e5e5e7] bg-white p-6 sm:p-10"><div className="grid gap-8 lg:grid-cols-[.7fr_1.3fr]"><div><p className="text-sm font-semibold text-[#0071e3]">关系性格侧写</p><h2 className="mt-3 text-3xl font-semibold">{relationshipLabel(relationshipScores)}</h2><p className="mt-4 leading-7 text-[#5c6963]">这部分不属于 MBTI。它描述你在亲密关系和深度友谊中的日常偏好，适合用来交流期待，而不是判断谁更好。</p></div><div className="space-y-5">{(Object.keys(relationshipMeta) as RelationshipDimension[]).map((key) => <TraitBar key={key} dimension={key} score={relationshipScores[key]} />)}</div></div></section><div className="mt-7 grid gap-5 rounded-2xl border border-[#e5e5e7] bg-[#eef2ef] p-6 md:grid-cols-[1fr_auto] md:items-center sm:p-8"><div><div className="flex items-center gap-2 text-sm font-semibold text-[#0071e3]"><LockKeyhole className="size-4" />可选下一步 · 仅限认证高校学生</div><h2 className="mt-2 text-2xl font-semibold">想认识新同学，可以带着这份结果进入社区。</h2><p className="mt-2 max-w-2xl leading-7 text-[#5c6963]">登录并完成高校身份认证后，测试结果会自动同步；再填写 20 题相处偏好，即可使用匹配、私信和全国高校广场。</p></div><Button asChild size="lg" className="h-12 rounded-lg bg-[#0071e3] px-6 hover:bg-[#0066cc]"><a href="/match">认证高校身份并进入<ArrowRight className="ml-2 size-4" /></a></Button></div><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button type="button" size="lg" onClick={onShare} className="rounded-lg bg-[#1d1d1f] hover:bg-black"><Share2 className="mr-2 size-4" />分享测试结果</Button><Button type="button" size="lg" variant="outline" onClick={onRestart} className="rounded-lg"><RotateCcw className="mr-2 size-4" />重新测试</Button></div><p className="mt-6 text-center text-sm text-[#86868b]">本测试参考常见人格维度重新设计，并非 MBTI® 官方测评，也不用于心理诊断。</p></div></section>;
}

function relationshipLabel(scores: Record<RelationshipDimension, number>) { return `${scores.connection > 0 ? "重陪伴" : "重空间"}的${scores.expression > 0 ? "直表达" : "行动派"}`; }
function DimensionBar({ dimension, score, shared, code }: { dimension: MbtiDimension; score: number; shared: boolean; code: string }) { const meta = mbtiMeta[dimension]; const index = (Object.keys(mbtiMeta) as MbtiDimension[]).indexOf(dimension); const right = shared ? code[index] === meta.rightCode : score > 0; const strength = shared ? 68 : Math.round(50 + Math.min(Math.abs(score) / 12, 1) * 45); const rightPercent = right ? strength : 100 - strength; return <div><div className="mb-2 flex items-center justify-between text-sm"><span className={!right ? "font-semibold text-[#315264]" : "text-[#86868b]"}>{meta.left} · {meta.leftCode}</span><span className="text-xs text-[#8b938f]">{meta.title}</span><span className={right ? "font-semibold text-[#6e6e73]" : "text-[#86868b]"}>{meta.rightCode} · {meta.right}</span></div><div className="relative h-2.5 overflow-hidden rounded-full bg-[#e9e9ec]"><div className="absolute inset-y-0 left-0 bg-[#526f80]" style={{ width: `${100 - rightPercent}%` }} /><div className="absolute inset-y-0 right-0 bg-[#a66d52]" style={{ width: `${rightPercent}%` }} /><span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-[#1d1d1f]" /></div><div className="mt-1 flex justify-between text-xs text-[#929a96]"><span>{100 - rightPercent}%</span><span>{rightPercent}%</span></div></div>; }
function TraitBar({ dimension, score }: { dimension: RelationshipDimension; score: number }) { const meta = relationshipMeta[dimension]; const rightPercent = Math.round(50 + Math.max(-4, Math.min(4, score)) / 4 * 45); return <div><div className="mb-2 flex items-center justify-between text-sm"><span className={rightPercent < 50 ? "font-semibold text-[#315264]" : "text-[#86868b]"}>{meta.left}</span><span className="text-xs text-[#8b938f]">{meta.title}</span><span className={rightPercent >= 50 ? "font-semibold text-[#6e6e73]" : "text-[#86868b]"}>{meta.right}</span></div><div className="relative h-2.5 overflow-hidden rounded-full bg-[#e9e9ec]"><div className="absolute inset-y-0 left-0 bg-[#526f80]" style={{ width: `${100 - rightPercent}%` }} /><div className="absolute inset-y-0 right-0 bg-[#a66d52]" style={{ width: `${rightPercent}%` }} /></div></div>; }
function ResultNote({ label, text }: { label: string; text: string }) { return <div className="rounded-2xl bg-[#f5f5f7] p-4"><span className="text-xs font-medium text-[#86868b]">{label}</span><p className="mt-2 text-sm font-medium leading-6">{text}</p></div>; }
