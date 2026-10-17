import { companions } from "@/lib/companions";

type Choice = { id: string; label: string; reply: string };
type Step = { prompt: string; choices: Choice[] };
type Scene = { id: string; companionId: string; title: string; intro: string; steps: Step[] };
function step(prompt: string, a: [string, string], b: [string, string]): Step {
  return { prompt, choices: [{ id: "a", label: a[0], reply: a[1] }, { id: "b", label: b[0], reply: b[1] }] };
}
export const companionProfiles = [
  { ...companions[0], personalityType: "INTP", interests: ["好奇心", "校园观察", "兴趣交换"], bio: "喜欢把一个小问题聊出新发现。可以和我练习破冰、交换兴趣，或把活动邀约说得更舒服。", opening: "不用急着说一句很精彩的话，我们从一个小问题开始。" },
  { ...companions[1], personalityType: "ISFJ", interests: ["散步", "日常分享", "慢慢熟悉"], bio: "留意日常的小事，也尊重安静的时间。可以和我练习分享近况、慢热开场，或邀请同学散步。", opening: "慢慢来也没关系。一件小事，就能成为认识彼此的起点。" },
] as const;
export const companionScenes: Scene[] = [
  { id: "class-break", companionId: "official-xiaotong", title: "课间的一句你好", intro: "练习从共同场景开始，不用一下就很熟。", steps: [
    step("设想课间遇到一位想认识的同学，你更愿意从哪句话开始？", ["刚才那道题，你也觉得有点难吗？", "从刚刚共同经历的事开始，很容易让对方接上话。"], ["我注意到你电脑上的贴纸，很有意思。", "具体的观察比笼统的夸奖更自然，也给对方一个愿意分享的入口。"]),
    step("聊了两句，你发现彼此都对某门选修课感兴趣，接下来呢？", ["问问对方为什么选这门课。", "一个开放的问题，能让对方按自己的节奏多说一点。"], ["先分享我选这门课的小故事。", "先分享自己，也能降低对方回应的压力，不用把对话变成提问清单。"]),
    step("快上课了，怎样给这次交流收个尾？", ["先去上课，下次课间再聊。", "轻松结束也很好。有共同场景，就不必急着要联系方式。"], ["如果你愿意，下次可以一起讨论作业。", "给出具体邀请，并留下选择空间，是很舒服的下一步。"]),
  ] },
  { id: "shared-interest", companionId: "official-xiaotong", title: "交换一个兴趣", intro: "把标签变成具体故事，让别人更容易认识你。", steps: [
    step("如果在广场介绍自己，你会先分享什么？", ["最近循环的一首歌，以及喜欢它的原因。", "一个具体的感受，往往比一句「我喜欢音乐」更容易引出共鸣。"], ["最近在研究的小问题，哪怕有一点冷门。", "冷门兴趣也值得分享。把让你好奇的地方讲清楚，就有人能接住。"]),
    step("对方分享了一个你不熟悉的兴趣，你想怎样回应？", ["我不太了解，最吸引你的部分是什么？", "不了解也可以坦诚说出来。好奇心本身就是一种回应。"], ["我想到一个类似的经历，想和你交换。", "用自己的经历搭一座桥，就算兴趣不同，也可以找到联系。"]),
    step("如果想把这个话题带到广场，准备怎么写？", ["分享一个具体经历，再问大家的故事。", "这会给其他同学一个清晰的接话点。可以试着从「最近一次……」开始。"], ["写一件想做的小事，看看有没有共同兴趣。", "把活动说具体，比只写「求搭子」更容易让别人判断是否合适。"]),
  ] },
  { id: "gentle-invite", companionId: "official-xiaotong", title: "一次舒服的邀请", intro: "练习说清活动，也给对方拒绝的空间。", steps: [
    step("想邀请刚认识的同学参加活动，你更倾向怎样开口？", ["周末想去看校内展览，你有兴趣吗？", "具体、轻量的活动，比较容易让对方判断自己的时间和意愿。"], ["你之前提到喜欢运动，要不要试试校内活动？", "联系对方分享过的兴趣，会让邀请更有来由。"]),
    step("对方说最近安排比较满，你会怎样回应？", ["没关系，等你方便时再说。", "接住对方的节奏就好，不需要马上追问新的时间。"], ["那我先去看看，之后可以分享见闻。", "没有一起参加，也可以自然保留交流，不把邀请变成压力。"]),
    step("如果双方都愿意参加，接下来确认什么？", ["时间、公共地点，以及大概活动时长。", "把安排说清楚，可以减少临时的不确定，也更容易各自做准备。"], ["先问问对方对节奏和预算的偏好。", "具体偏好比猜测更可靠。双方舒服，比安排得多精彩更重要。"]),
  ] },
  { id: "campus-walk", companionId: "official-xiaopin", title: "绕操场走一圈", intro: "从校园里的小角落，练习接住一句分享。", steps: [
    step("假设我们在聊校园散步，你想先分享哪一件事？", ["我喜欢晚霞出现时的操场。", "晚霞是个很容易接住的话题。可以再说说那个时刻让你觉得舒服的地方。"], ["我更喜欢图书馆旁边安静的小路。", "安静的小路也有自己的气氛。一个具体地点，能让分享更有画面。"]),
    step("有同学说自己不太爱出门，你想怎样继续？", ["那你平时怎样让自己放松？", "把好奇放在对方的体验上，就不用要求彼此喜欢同一件事。"], ["我也有只想在宿舍待着的时候。", "承认自己也有不同状态，常常能让对方更自在。"]),
    step("想邀请同学一起走走，哪种说法更像你？", ["哪天你也想散步，可以一起绕一圈。", "给对方一个轻轻的邀请就足够，时间可以等双方都有意愿时再约。"], ["我先把这条路线分享在广场，大家按节奏来。", "分享路线也是很好的参与方式，不一定每次都要马上约成活动。"]),
  ] },
  { id: "little-moment", companionId: "official-xiaopin", title: "分享今天的小事", intro: "不用写得精彩，一件真实的小事也有温度。", steps: [
    step("今天如果只分享一件小事，你会选哪一种？", ["食堂有一道菜，比预想中好吃。", "这样的小发现也值得分享。可以说说你为什么愿意再点一次。"], ["有人顺手帮了我一下，我记住了。", "被照顾到的瞬间，常常很轻，却会留在心里。可以写下当时的具体细节。"]),
    step("看到其他同学分享近况，你更愿意怎样接一句？", ["问问他当时的感受。", "一个不急着下结论的问题，能让对方决定愿意分享多少。"], ["说说我也遇到过的一件相似小事。", "交换经历时，也可以留一点篇幅接住对方，不必马上把话题带走。"]),
    step("如果对方暂时没有回复，你准备怎样安排自己的节奏？", ["先去做自己的事，等方便时再聊。", "交流不需要一直在线。把时间留给自己的生活，也是一种舒服的边界。"], ["让这次分享停在这里，下次有话再说。", "一次对话可以自然结束。没有继续接话，也不代表这次分享没有意义。"]),
  ] },
  { id: "slow-hello", companionId: "official-xiaopin", title: "慢热也能开个头", intro: "不用假装外向，找到适合自己的表达方式。", steps: [
    step("遇到想认识的同学，但一时不知道说什么，你会怎么做？", ["先在他公开的分享下认真接一句。", "从已有的话题回应，很适合慢慢认识一个人。说具体一点就很好。"], ["先想一件自己愿意分享的真实小事。", "从自己的经历出发，也能给对方一个理解你的入口。"]),
    step("如果对方聊得很热情，而你需要一点时间，你会怎样表达？", ["我有点慢热，但会认真看你说的话。", "把习惯讲清楚，比勉强自己一直热闹更容易建立舒服的交流。"], ["我可能回得慢一些，空下来再接着聊。", "表达节奏也可以很自然，让对方知道你怎样相处就好。"]),
    step("这次练习之后，你想尝试哪一小步？", ["去广场回复一个有共鸣的话题。", "只接一句也算参与。选一个你真的想聊的话题，不需要一次认识很多人。"], ["先完善一段能够代表自己的介绍。", "一段真实的介绍，也是在为未来的交流留一个起点。按自己的节奏来。"]),
  ] },
];
export function getCompanion(id: string) { return companionProfiles.find((item) => item.id === id); }
export function getCompanionScene(companionId: string, sceneId: string) { return companionScenes.find((item) => item.companionId === companionId && item.id === sceneId); }
export type ExperienceMessage = { id: string; role: "user" | "companion"; text: string };
export type ExperienceState = { companionId: string; sceneId: string; revision: number; started: boolean; complete: boolean; messages: ExperienceMessage[]; options: { id: string; label: string }[] };
export function experienceState(companionId: string, sceneId: string, choices: string[], revision: number): ExperienceState {
  const scene = getCompanionScene(companionId, sceneId);
  if (!scene || choices.length > scene.steps.length) throw new Error("情境记录无效。");
  const messages: ExperienceMessage[] = [];
  scene.steps.forEach((item, i) => {
    if (i > choices.length) return;
    messages.push({ id: `prompt-${i}`, role: "companion", text: item.prompt });
    if (i < choices.length) {
      const choice = item.choices.find((option) => option.id === choices[i]);
      if (!choice) throw new Error("情境选择无效。");
      messages.push({ id: `choice-${i}`, role: "user", text: choice.label }, { id: `reply-${i}`, role: "companion", text: choice.reply });
    }
  });
  return { companionId, sceneId, revision, started: true, complete: choices.length === scene.steps.length, messages, options: (scene.steps[choices.length]?.choices || []).map(({ id, label }) => ({ id, label })) };
}
