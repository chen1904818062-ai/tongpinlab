import { redirect } from "next/navigation";
import { getCompanion } from "@/lib/companion-experience";

export const dynamic = "force-dynamic";

export default async function MatchPage({ searchParams }: { searchParams: Promise<{ tab?: string; companion?: string }> }) {
  const query = await searchParams;
  const params = new URLSearchParams({ tab: query.tab && ["match", "plaza", "chat", "profile"].includes(query.tab) ? query.tab : "match" });
  if (query.companion && getCompanion(query.companion)) params.set("companion", query.companion);
  redirect(`/community?${params.toString()}`);
}
