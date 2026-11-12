"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { countLabel, formatDuration } from "@/lib/format";
import type { RunSummary } from "@/server/runs-api";
import { runState } from "@/ui/labels";
import { StatusIcon } from "./StatusIcon";

export interface RunListItem extends RunSummary {
  ago: string; // "2m", worked out on the server
  slow: boolean; // one step took most of the run's time
}

type Filter = "all" | "failed" | "slow";

const EMPTY_MESSAGES: Record<Exclude<Filter, "all">, string> = {
  failed: "No failed runs.",
  slow: "No slow runs.",
};

function useRefreshOnReturn() {
  const router = useRouter();

  // Coming back to this tab, say from the terminal after `npm run agent`,
  // reloads the data, so new runs show up without a manual refresh.
  useEffect(() => {
    const refresh = () => router.refresh();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [router]);

  return router;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-6.5 rounded-full border px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-model ${
        active ? "border-chip-edge bg-chip text-fg" : "border-edge-strong text-fg-faint hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}

function ListHeading({ todayCount }: { todayCount?: number }) {
  return (
    <div className="flex items-baseline justify-between px-1.5">
      <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em]">Runs</h2>
      {todayCount !== undefined && <span className="text-xs text-muted">{todayCount} today</span>}
    </div>
  );
}

export function RunList({ items, todayCount, demo }: { items: RunListItem[]; todayCount: number; demo: boolean }) {
  const { id: openId } = useParams<{ id?: string }>();
  const [filter, setFilter] = useState<Filter>("all");
  useRefreshOnReturn();

  // "Failed" means the run stopped without an answer, so it matches the red
  // icons. "Slow" means one step took most of the run's time.
  const failed = items.filter((item) => runState(item.status) === "stopped");
  const slow = items.filter((item) => item.slow);
  const shown = filter === "failed" ? failed : filter === "slow" ? slow : items;

  return (
    <>
      <ListHeading todayCount={todayCount} />
      <div role="group" aria-label="Filter runs" className="flex gap-1.5 px-1.5">
        <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
          All
        </FilterChip>
        <FilterChip active={filter === "failed"} onClick={() => setFilter("failed")}>
          Failed · {failed.length}
        </FilterChip>
        <FilterChip active={filter === "slow"} onClick={() => setFilter("slow")}>
          Slow · {slow.length}
        </FilterChip>
      </div>

      {shown.length === 0 ? (
        <p className="px-1.5 leading-relaxed text-muted">
          {items.length === 0 && demo ? (
            "No recorded runs yet."
          ) : items.length === 0 ? (
            <>
              No runs yet. With the server running, try{" "}
              <code className="font-mono text-xs text-fg-soft">npm run agent -- &quot;your question&quot;</code>
            </>
          ) : filter === "all" ? null : (
            EMPTY_MESSAGES[filter]
          )}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {shown.map((item) => {
            const open = item.id === openId;

            return (
              <li key={item.id}>
                <Link
                  href={`/runs/${item.id}`}
                  aria-current={open ? "page" : undefined}
                  className={`grid grid-cols-[18px_minmax(0,1fr)_auto] items-start gap-2 rounded-[10px] px-2.5 py-2.75 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-model ${
                    open ? "bg-raised" : "hover:bg-raised/60"
                  }`}
                >
                  <StatusIcon status={item.status} className="mt-px size-4" />
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className={`line-clamp-2 leading-[1.35] ${open ? "font-medium" : ""}`}>{item.question}</span>
                    <span className="text-[11.5px] text-muted">
                      {formatDuration(item.durationMs)} · {countLabel(item.stepCount, "step")}
                      {item.slow && " · slow"}
                    </span>
                  </span>
                  <span className="text-[11.5px] text-muted">{item.ago}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function RunListError() {
  const router = useRefreshOnReturn();

  return (
    <>
      <ListHeading />
      <div className="mx-1.5 flex flex-col items-start gap-2 rounded-[10px] border border-bad-edge bg-bad-tint p-3">
        <p className="text-bad-soft">Couldn&apos;t load runs. Is the database reachable?</p>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="h-6.5 rounded-md border border-edge-strong px-2.5 text-xs text-fg-dim hover:text-fg"
        >
          Try again
        </button>
      </div>
    </>
  );
}
