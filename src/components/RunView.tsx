"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format";
import { findFlags } from "@/flags/find-flags";
import { computeTotals } from "@/recorder/totals";
import type { Run } from "@/recorder/types";
import { readToolUseFailure } from "@/ui/errors";
import { explainsError } from "@/ui/flags";
import { fullTokens, statusLabel } from "@/ui/labels";
import { buildRows, timeAxis } from "@/ui/waterfall";
import { FlagPills } from "./Flags";
import { RawView } from "./RawView";
import { StatusBadge } from "./StatusIcon";
import { RunOverview, StepDetails } from "./StepDetails";
import { Waterfall } from "./Waterfall";

type View = "timeline" | "raw";

const VIEWS: { value: View; label: string }[] = [
  { value: "timeline", label: "Timeline" },
  { value: "raw", label: "Raw" },
];

// When the address names no step, open the first failed one: that's usually
// where the run went wrong. Otherwise start on the run overview.
function startingStep(run: Run, stepFromUrl: string | null): string | null {
  if (stepFromUrl && run.steps.some((step) => step.id === stepFromUrl)) return stepFromUrl;
  return run.steps.find((step) => !step.ok)?.id ?? null;
}

function ViewSwitch({ value, onChange }: { value: View; onChange: (view: View) => void }) {
  return (
    <div role="group" aria-label="View" className="flex gap-0.5 rounded-[9px] border border-edge bg-field p-0.75">
      {VIEWS.map((view) => (
        <button
          key={view.value}
          type="button"
          aria-pressed={value === view.value}
          onClick={() => onChange(view.value)}
          className={`h-7 rounded-md px-3 text-[12.5px] focus-visible:outline-2 focus-visible:outline-model ${
            value === view.value ? "bg-[#1b1c21] font-medium text-fg" : "text-fg-faint hover:text-fg"
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}

export function RunView({ run, stepFromUrl }: { run: Run; stepFromUrl: string | null }) {
  const totals = computeTotals(run);
  const flags = findFlags(run);
  const rows = buildRows(run, totals.durationMs, flags);
  const axis = timeAxis(totals.durationMs);
  const [chosenId, setChosenId] = useState(() => startingStep(run, stepFromUrl));
  const [view, setView] = useState<View>("timeline");
  const chosenRow = rows.find((row) => row.step.id === chosenId) ?? null;

  function choose(id: string | null) {
    setChosenId(id);
    // Puts the chosen step in the address (?step=s4) without reloading, so
    // the link can be shared and a reload keeps your place.
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("step", id);
    else url.searchParams.delete("step");
    window.history.replaceState(null, "", url);
  }

  return (
    <>
      <main className="scrollbar-dark flex w-full min-w-0 flex-col gap-5 px-4 py-5 sm:px-7 sm:py-6 md:w-auto md:flex-1 xl:overflow-y-auto">
        <div className="flex flex-wrap items-start justify-between gap-3.5">
          <div className="flex min-w-0 items-start gap-3.5">
            <StatusBadge status={run.status} />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h1 className="font-display text-2xl leading-[1.2] font-semibold tracking-tight wrap-break-word">
                {run.question}
              </h1>
              <p className="text-[12.5px] text-muted">
                {statusLabel(run.status)} · {formatDuration(totals.durationMs)} · {fullTokens(totals.tokens)} ·{" "}
                <span className="font-mono text-xs">{run.id}</span>
              </p>
            </div>
          </div>
          <ViewSwitch value={view} onChange={setView} />
        </div>

        <FlagPills flags={flags} onChoose={choose} />

        {/* Only for an error no flag explains, since the pills and "What went
            wrong" already say it. A Groq tool error shows its plain sentence. */}
        {run.error && !explainsError(flags) && (
          <p role="status" className="rounded-[10px] border border-bad-edge bg-bad-tint px-3.5 py-2.5 leading-relaxed text-bad-soft">
            {readToolUseFailure(run.error)?.summary ?? run.error}
          </p>
        )}

        {view === "timeline" ? (
          <Waterfall rows={rows} axis={axis} chosenId={chosenId} onChoose={choose} runError={run.error} />
        ) : (
          <RawView run={run} />
        )}
      </main>

      <aside
        aria-label="Details"
        className="scrollbar-dark w-full border-t border-line bg-side px-4 py-6 sm:px-5.5 xl:w-95 xl:shrink-0 xl:overflow-y-auto xl:border-t-0 xl:border-l"
      >
        {chosenRow ? (
          <StepDetails
            row={chosenRow}
            runError={run.error}
            flags={flags.filter((flag) => flag.stepId === chosenRow.step.id)}
          />
        ) : (
          <RunOverview run={run} totals={totals} flags={flags.filter((flag) => flag.stepId === null)} />
        )}
      </aside>
    </>
  );
}
