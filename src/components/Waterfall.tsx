"use client";

import { ChevronDown } from "lucide-react";
import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { countLabel, formatDuration } from "@/lib/format";
import type { Step } from "@/recorder/types";
import { shortTokens } from "@/ui/labels";
import { stepNote, type Bar, type TimeAxis, type WaterfallRow } from "@/ui/waterfall";


const INDENT_PX = 21;

const ROW_GRID = "grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]";

const LABEL_FLIP_PERCENT = 85;

interface WaterfallProps {
  rows: WaterfallRow[];
  axis: TimeAxis;
  chosenId: string | null;
  onChoose: (id: string | null) => void;
  runError: string | null; // the whole error, for a step whose copy was cut short
}

const BAR_COLOURS: Record<Step["type"], string> = {
  model: "bg-model",
  tool: "bg-tool",
  answer: "bg-answer",
};

function Marker({ step }: { step: Step }) {
  // Squares for model calls and the answer, dots for tools, like the design.
  const shape = step.type === "tool" ? "rounded-full" : "rounded-[2px]";
  const colour = !step.ok ? "bg-bad" : BAR_COLOURS[step.type];
  return <span className={`size-2 shrink-0 ${shape} ${colour}`} aria-hidden="true" />;
}

// The strip a bar sits on, with faint lines at each tick of the time scale.
function Track({ gridPercent, chosen, children }: { gridPercent: number; chosen: boolean; children?: ReactNode }) {
  const style: CSSProperties = {
    backgroundImage: `linear-gradient(90deg, ${chosen ? "#1b1a22" : "var(--color-grid)"} 1px, transparent 1px)`,
    backgroundSize: `${gridPercent}% 100%`,
  };
  return (
    <span className="relative block h-5.5" style={style}>
      {children}
    </span>
  );
}

function durationLabelStyle(bar: Bar): CSSProperties {
  const end = bar.leftPercent + bar.widthPercent;
  return end > LABEL_FLIP_PERCENT ? { right: `${100 - bar.leftPercent + 1.5}%` } : { left: `${end + 1.5}%` };
}

function StepRow({
  row,
  steps,
  runError,
  axis,
  chosen,
  onChoose,
  registerButton,
}: {
  row: WaterfallRow;
  steps: Step[];
  runError: string | null;
  axis: TimeAxis;
  chosen: boolean;
  onChoose: (id: string) => void;
  registerButton: (element: HTMLButtonElement | null) => void;
}) {
  const { step, bar } = row;
  const isTool = step.type === "tool";
  const barColour = !step.ok ? "bg-bad" : chosen && step.type === "model" ? "bg-model-strong" : BAR_COLOURS[step.type];
  const note = chosen ? stepNote(step, steps, runError) : null;
  const indent = INDENT_PX * (row.depth + 1);

  return (
    <div className={chosen ? "border-y border-chosen-line bg-chosen" : ""}>
      <button
        ref={registerButton}
        type="button"
        aria-pressed={chosen}
        onClick={() => onChoose(step.id)}
        className={`${ROW_GRID} h-10 w-full items-center px-4 text-left hover:bg-chosen focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-model`}
      >
        <span className="flex min-w-0 items-center gap-2.25 overflow-hidden" style={{ paddingLeft: indent }}>
          <Marker step={step} />
          {/* The name keeps its width; when space runs out, the argument
              next to it is the part that gets shortened. */}
          <span
            className={`max-w-[70%] shrink-0 truncate ${isTool ? "font-mono text-xs text-fg-soft" : ""} ${chosen && !isTool ? "font-semibold" : ""}`}
          >
            {row.label}
          </span>
          {/* "error" comes before the argument, so it's never the part cut off. */}
          {!step.ok && <span className="shrink-0 text-[11.5px] text-bad">error</span>}
          {row.detail && <span className="min-w-0 truncate font-mono text-xs text-muted">{row.detail}</span>}
          {step.tokens !== null && (
            <span className="hidden shrink-0 text-[11.5px] text-muted sm:inline">{shortTokens(step.tokens)}</span>
          )}
        </span>
        <Track gridPercent={axis.gridPercent} chosen={chosen}>
          <span
            className={`absolute top-1.25 h-3 rounded ${barColour} ${chosen ? "shadow-[0_0_0_3px_rgba(164,151,250,0.18)]" : ""}`}
            style={{ left: `${bar.leftPercent}%`, width: `${bar.widthPercent}%` }}
          />
          {step.type !== "answer" && (
            <span
              className={`absolute top-0.75 text-[11.5px] tabular-nums ${chosen ? "font-medium text-fg" : "text-fg-faint"}`}
              style={durationLabelStyle(bar)}
            >
              {formatDuration(step.durationMs)}
            </span>
          )}
        </Track>
      </button>

      {note && (
        <div
          className="mx-4 mb-3.5 flex flex-col gap-2 rounded-[10px] border border-chosen-line bg-card px-3.5 py-3"
          style={{ marginLeft: indent + 25 }}
        >
          <span className="text-[11.5px] text-muted">{note.label}</span>
          {note.text && (
            <span className={`font-mono text-xs wrap-break-word ${step.ok ? "text-fg-soft" : "text-bad-soft"}`}>
              {note.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Waterfall({ rows, axis, chosenId, onChoose, runError }: WaterfallProps) {
  const steps = rows.map((row) => row.step);
  // The buttons in order, Run row first, so the arrow keys can move between them.
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const order: (string | null)[] = [null, ...steps.map((step) => step.id)];

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();

    const current = order.indexOf(chosenId);
    const next = Math.min(order.length - 1, Math.max(0, current + (event.key === "ArrowDown" ? 1 : -1)));
    onChoose(order[next]);
    buttons.current[next]?.focus();
  }

  const runChosen = chosenId === null;

  return (
    <section aria-label="Timeline" className="overflow-hidden rounded-[14px] border border-edge bg-card">
      <div className={`${ROW_GRID} border-b border-line px-4 py-2.5 text-[11.5px] text-muted tabular-nums`}>
        <span>{countLabel(rows.length, "step")}</span>
        <span className="relative h-4" aria-hidden="true">
          {/* Phones only have room for the start and the total. */}
          {axis.ticks.map((tick, index) => (
            <span
              key={tick.label}
              className={`absolute ${index > 0 ? "hidden sm:inline" : ""}`}
              style={{ left: `${tick.percent}%` }}
            >
              {tick.label}
            </span>
          ))}
          <span className="absolute right-0">{axis.endLabel}</span>
        </span>
      </div>

      <div onKeyDown={onKeyDown} className="pb-1">
        <div className={runChosen ? "border-y border-chosen-line bg-chosen" : ""}>
          <button
            ref={(element) => {
              buttons.current[0] = element;
            }}
            type="button"
            aria-pressed={runChosen}
            onClick={() => onChoose(null)}
            className={`${ROW_GRID} h-10 w-full items-center px-4 text-left hover:bg-chosen focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-model`}
          >
            <span className="flex items-center gap-2.25">
              <ChevronDown className="size-3 text-muted" strokeWidth={2.4} aria-hidden="true" />
              <span className={runChosen ? "font-semibold" : "font-medium"}>Run</span>
            </span>
            <Track gridPercent={axis.gridPercent} chosen={runChosen}>
              <span className="absolute top-2.25 left-0 h-1 w-full rounded-sm bg-run-bar" />
            </Track>
          </button>
        </div>

        {rows.map((row, index) => (
          <StepRow
            key={row.step.id}
            row={row}
            steps={steps}
            runError={runError}
            axis={axis}
            chosen={row.step.id === chosenId}
            onChoose={onChoose}
            registerButton={(element) => {
              buttons.current[index + 1] = element;
            }}
          />
        ))}
      </div>
    </section>
  );
}
