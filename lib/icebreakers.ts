export const icebreakerCategories = ["轻松开场", "校园日常", "兴趣交换", "慢慢了解"] as const;
export type IcebreakerCategory = typeof icebreakerCategories[number];
type Topic = { title: string; prompt: string };
const topics: Record<IcebreakerCategory, Topic[]> = {
  "轻松开场": [
    { title: "今天的小确幸", prompt: "今天有没有一件小事，让你觉得心情还不错？" },
    { title: "分享一首歌", prompt: "如果用一首歌介绍最近的自己，你会选哪一首？" },
    { title: "理想的周末", prompt: "如果周末空出半天，你最想怎么度过？" },
    { title: "一个轻松的选择", prompt: "散步、看电影、找家小店坐坐，你更喜欢哪一种放松方式？" },
    { title: "最近的期待", prompt: "最近有没有一件还没发生、但已经开始期待的事？" },
    { title: "随手推荐", prompt: "最近有什么值得分享的小发现吗？吃的、看的、听的都可以。" },
  ],
  "校园日常": [
    { title: "校园宝藏角落", prompt: "你们学校有没有一个你特别喜欢、但不算热闹的角落？" },
    { title: "食堂推荐", prompt: "如果我去你们学校，你会推荐哪一道食堂招牌？" },
    { title: "有趣的一堂课", prompt: "最近有没有哪堂课，意外地让你觉得挺有意思？" },
    { title: "下课之后", prompt: "结束一天的课之后，你一般怎么给自己充电？" },
    { title: "校园散步路线", prompt: "如果在校园里随意走走，你通常会从哪里走到哪里？" },
    { title: "想试试的活动", prompt: "这学期有没有想尝试的新活动或社团？" },
  ],
  "兴趣交换": [
    { title: "互换片单", prompt: "最近有没有一部你愿意推荐的电影、剧或纪录片？" },
    { title: "开始喜欢的契机", prompt: "你现在最喜欢的一个兴趣，当初是怎么开始的？" },
    { title: "一起学点什么", prompt: "如果可以轻松学会一项新技能，你现在最想选什么？" },
    { title: "兴趣里的小细节", prompt: "在你喜欢的事情里，有什么细节是别人不太注意、你却很享受的？" },
    { title: "分享一本书", prompt: "有没有一本书、一个播客或一篇文章，最近给了你一点新的想法？" },
    { title: "周末去哪里", prompt: "你更喜欢在熟悉的地方放松，还是偶尔去没去过的地方看看？" },
  ],
  "慢慢了解": [
    { title: "舒服的交流", prompt: "认识新朋友时，什么样的交流节奏会让你觉得比较舒服？" },
    { title: "充电方式", prompt: "忙了一天之后，你更想独处一会儿，还是和熟悉的人聊聊天？" },
    { title: "朋友眼中的你", prompt: "如果请熟悉的朋友用一个词介绍你，他们可能会怎么说？" },
    { title: "想分享的日常", prompt: "平时遇到有趣的小事，你会马上找人分享，还是先留在自己心里？" },
    { title: "喜欢的相处", prompt: "和朋友相处时，有没有一种小小的举动，会让你觉得很被理解？" },
    { title: "留一点自由", prompt: "如果没有安排的一天，你喜欢随心走走，还是给自己列个小计划？" },
  ],
};
export function conversationTopics(category: IcebreakerCategory, sharedInterests: string[], group: number): Topic[] {
  const list = [...topics[category]];
  const shared = sharedInterests.find(value => typeof value === "string" && value.trim() && value.length <= 24)?.trim();
  if (category === "兴趣交换" && shared) list.unshift({ title: `都喜欢${shared}`, prompt: `看到我们都喜欢${shared}，你最近在这方面有没有什么想分享的小发现？` });
  const start = (Math.max(0, group) * 3) % list.length;
  return Array.from({ length: 3 }, (_, index) => list[(start + index) % list.length]);
}
