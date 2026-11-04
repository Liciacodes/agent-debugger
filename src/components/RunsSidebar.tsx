import { connection } from "next/server";
import type { Run } from "@/recorder/types";
import { prismaStore } from "@/server/prisma-store";
import { RUN_LIST_LIMIT, toSummary } from "@/server/runs-api";
import { isSameDay, timeAgo } from "@/ui/labels";
import { RunList, RunListError, type RunListItem } from "./RunList";

// Loads the runs list from the database on the server. It runs for each visit,
// never ahead of time during `next build`.
export async function RunsSidebar() {
  await connection();
  let runs: Run[];

  try {
    runs = await prismaStore.listRuns(RUN_LIST_LIMIT);
  } catch (error) {
    // The message only: a database error can include details about the query.
    console.error("Loading the runs list failed:", error instanceof Error ? error.message : String(error));
    return <RunListError />;
  }

  // React's rule guards components that render again and again. This one
  // renders once per visit, after connection(), which is how Next's docs say
  // to read the current time.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const items: RunListItem[] = runs.map((run) => ({ ...toSummary(run), ago: timeAgo(run.startedAt, now) }));
  const todayCount = runs.filter((run) => isSameDay(run.startedAt, now)).length;

  return <RunList items={items} todayCount={todayCount} />;
}
