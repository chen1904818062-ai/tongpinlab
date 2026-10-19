import "server-only";
import { getD1 } from "@/db";
import { companions, officialTopics, companionReply } from "@/lib/companions";
import type { PlazaComment, PlazaPost, PlazaSnapshot } from "@/lib/plaza-types";

type Row = Record<string, unknown>;
function comment(row: Row): PlazaComment {
  return { id: Number(row.id), authorId: String(row.author_id), authorName: String(row.display_name), avatar: row.photo_url ? String(row.photo_url) : undefined, personalityType: String(row.personality_type || ""), body: String(row.body), createdAt: String(row.created_at) };
}
export async function getOfficialPlazaPosts(viewerId = ""): Promise<PlazaPost[]> {
  const db = getD1();
  const [comments, likes, counts] = await Promise.all([
    db.prepare(`SELECT pc.*, u.display_name, p.personality_type, p.photo_url FROM plaza_comments pc JOIN users u ON u.id = pc.author_id LEFT JOIN profiles p ON p.user_id = u.id WHERE pc.post_id IN (${officialTopics.map(() => "?").join(",")}) AND pc.status = 'visible' AND u.status = 'active' AND u.campus_verified = 1 ORDER BY pc.id DESC LIMIT 200`).bind(...officialTopics.map((topic) => topic.id)).all<Row>(),
    db.prepare(`SELECT post_id, COUNT(*) AS count, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked FROM plaza_likes WHERE post_id < 0 GROUP BY post_id`).bind(viewerId).all<Row>(),
    db.prepare(`SELECT pc.post_id, COUNT(*) AS count FROM plaza_comments pc JOIN users u ON u.id = pc.author_id WHERE pc.post_id < 0 AND pc.status = 'visible' AND u.status = 'active' AND u.campus_verified = 1 GROUP BY pc.post_id`).all<Row>(),
  ]);
  return officialTopics.map((topic) => {
    const actor = companions[topic.companion];
    const real = comments.results.filter((row) => Number(row.post_id) === topic.id);
    const activity = likes.results.find((row) => Number(row.post_id) === topic.id);
    const displayed = real.slice(0, 3).reverse().flatMap((row) => {
      const value = comment(row);
      return [value, { id: -value.id, authorId: actor.id, authorName: actor.name, avatar: actor.image, personalityType: "", body: companionReply(topic.id), createdAt: value.createdAt, official: true }];
    });
    return { id: topic.id, authorId: actor.id, authorName: actor.name, university: "同频实验室", personalityType: "", category: topic.category, audience: "public", content: topic.content, likeCount: Number(activity?.count || 0), commentCount: Number(counts.results.find((row) => Number(row.post_id) === topic.id)?.count || 0), viewerLiked: Number(activity?.liked) === 1, createdAt: "2026-10-17T00:00:00+08:00", comments: displayed, official: true, avatar: actor.image };
  });
}
export async function getPublicCommunitySnapshot(personalityType: string, viewerId = ""): Promise<PlazaSnapshot> {
  const db = getD1();
  const [official, rows, comments] = await Promise.all([
    getOfficialPlazaPosts(viewerId),
    db.prepare(`SELECT pp.*, u.display_name, u.university, p.personality_type, p.photo_url,
      (SELECT COUNT(*) FROM plaza_likes pl WHERE pl.post_id = pp.id) AS like_count,
      (SELECT COUNT(*) FROM plaza_comments pc JOIN users cu ON cu.id = pc.author_id WHERE pc.post_id = pp.id AND pc.status = 'visible' AND cu.status = 'active') AS comment_count
      FROM plaza_posts pp JOIN users u ON u.id = pp.author_id LEFT JOIN profiles p ON p.user_id = u.id
      WHERE pp.audience = 'public' AND pp.status = 'visible' AND u.status = 'active' AND u.campus_verified = 1 AND u.questionnaire_completed = 1 AND u.role != 'demo'
      ORDER BY pp.created_at DESC LIMIT 50`).all<Row>(),
    db.prepare(`SELECT pc.*, u.display_name, p.personality_type, p.photo_url FROM plaza_comments pc JOIN users u ON u.id = pc.author_id LEFT JOIN profiles p ON p.user_id = u.id JOIN plaza_posts pp ON pp.id = pc.post_id JOIN users author ON author.id = pp.author_id
      WHERE pp.audience = 'public' AND pp.status = 'visible' AND author.status = 'active' AND author.campus_verified = 1 AND author.questionnaire_completed = 1 AND author.role != 'demo' AND pc.status = 'visible' AND u.status = 'active'
      ORDER BY pc.id DESC LIMIT 200`).all<Row>(),
  ]);
  const posts: PlazaPost[] = rows.results.map((row) => ({ id: Number(row.id), authorId: String(row.author_id), authorName: String(row.display_name), avatar: row.photo_url ? String(row.photo_url) : undefined, university: String(row.university || ""), personalityType: String(row.personality_type || ""), category: String(row.category), audience: "public", content: String(row.content), likeCount: Number(row.like_count), commentCount: Number(row.comment_count), viewerLiked: false, createdAt: String(row.created_at), comments: comments.results.filter((item) => Number(item.post_id) === Number(row.id)).slice(0, 3).reverse().map(comment) }));
  return { viewer: { university: "", personalityType }, posts: [official[0], ...posts, ...official.slice(1)] };
}
