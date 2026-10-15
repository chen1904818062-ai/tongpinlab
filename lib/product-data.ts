export type Question = {
  id: string;
  dimension: string;
  text: string;
  hint?: string;
};

export type QuestionSection = {
  id: string;
  title: string;
  subtitle: string;
  questions: Question[];
};

function section(id: string, title: string, subtitle: string, texts: string[]): QuestionSection {
  return {
    id,
    title,
    subtitle,
    questions: texts.map((text, index) => ({
      id: `${id}-${String(index + 1).padStart(2, "0")}`,
      dimension: id,
      text,
    })),
  };
}

export const questionSections: QuestionSection[] = [
  section("life", "校园生活", "了解作息、见面与消费习惯", [
    "相比当天临时决定，我更喜欢提前约好见面的时间和地点。",
    "周末没有安排时，我通常更愿意出门，而不是一直待在宿舍。",
    "即使课程很忙，我也愿意为重要的人固定留出一段时间。",
    "约会或共同活动时，我更偏好量力而行、提前说清预算。",
  ]),
  section("communication", "联系与沟通", "比较消息频率和分歧处理习惯", [
    "即使很忙，我也希望彼此每天至少有一次简短联系。",
    "让我不舒服的事情，我更愿意当面说清楚，而不是等对方自己察觉。",
    "发生分歧后，我通常需要先独处一段时间，再继续沟通。",
    "我喜欢分享食堂、课程和路上见闻等日常小事。",
  ]),
  section("relationship", "关系期待", "确认认识节奏与投入方向", [
    "现阶段，我更希望发展认真稳定的关系，而不是不设目标地认识。",
    "确定恋爱关系前，我愿意先以朋友身份相处一段时间。",
    "关系稳定后，我希望在朋友或同学中自然公开。",
    "恋爱中，我仍希望保留独立的朋友圈、兴趣和独处时间。",
  ]),
  section("values", "现实选择", "了解毕业、异地与家庭因素", [
    "如果毕业去向发生冲突，我愿意为关系调整一部分原计划。",
    "只要有明确的结束时间和见面安排，我能接受阶段性异地。",
    "面对家人的意见，我会认真听取，但最终保留自己的决定。",
    "我希望较早讨论毕业城市、工作节奏和消费习惯等现实问题。",
  ]),
  section("boundaries", "个人边界", "说清空间、隐私和社交边界", [
    "即使在恋爱中，我也不希望彼此长期共享实时定位。",
    "我能接受对方与异性朋友单独活动，前提是彼此坦诚沟通。",
    "没有及时回复消息时，我希望彼此说明原因，但不需要随时汇报行程。",
    "发布合照或公开关系动态前，我希望双方先确认彼此都舒服。",
  ]),
];

export const allQuestions = questionSections.flatMap((item) => item.questions);

export const scaleLabels = ["非常不同意", "不太同意", "一般", "比较同意", "非常同意"];

export const demoCandidate = {
  id: "demo-candidate",
  name: "陈澄",
  age: 22,
  major: "新闻与传播",
  grade: "研一",
  university: "复旦大学",
  campus: "主校区",
  hometown: "江苏南京",
  bio: "喜欢逛展、看纪录片，也在校园媒体做内容。希望遇见一个真诚、愿意沟通，也保留自己热爱的人。",
  interests: ["摄影", "纪录片", "羽毛球", "城市漫步"],
  image: "/campus-match.png",
  personalityType: "ENFP",
  personalityScores: { energy: 7, information: 10, decision: 8, rhythm: 5 },
  score: 92,
  reasons: ["MBTI 倾向都重视真实表达与精神共鸣", "关系中的联系频率与表达习惯接近", "生活方式、长期期待和安全边界相容"],
};
