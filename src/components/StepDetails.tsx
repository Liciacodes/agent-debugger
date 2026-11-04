import type { ReactNode } from "react";
import { formatDuration } from "@/lib/format";
import type { RunTotals } from "@/recorder/totals";
import type { Run } from "@/recorder/types";
import { fullTokens, statusLabel } from "@/ui/labels";
import { stepKind, type WaterfallRow } from "@/ui/waterfall";
import { FormattedText } from "./FormattedText";

// Tool arguments arrive as one line of JSON; spread them out to read.
function readableJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function Heading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{kicker}</span>
      <h2 className="font-display text-lg font-semibold tracking-[-0.015em] wrap-break-word">{title}</h2>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-fg-soft tabular-nums">{children}</dd>
    </div>
  );
}

function Result({ ok }: { ok: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${ok ? "bg-ok" : "bg-bad"}`} aria-hidden="true" />
      {ok ? "OK" : "Error"}
    </span>
  );
}

function TextBlock({
  title,
  text,
  tone = "plain",
  markdown = false,
}: {
  title: string;
  text: string;
  tone?: "plain" | "bad";
  markdown?: boolean; // show **bold** and `code` styled
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs text-muted">{title}</h3>
      <pre
        className={`scrollbar-dark max-h-80 overflow-auto rounded-[10px] border px-3 py-2.5 font-mono text-xs leading-[1.7] whitespace-pre-wrap wrap-break-word ${
          tone === "bad" ? "border-bad-edge bg-bad-tint text-bad-soft" : "border-edge bg-field text-fg-soft"
        }`}
      >
        {markdown ? <FormattedText text={text} /> : text}
      </pre>
    </section>
  );
}

export function StepDetails({ row }: { row: WaterfallRow }) {
  const { step } = row;

  return (
    <div className="flex flex-col gap-5">
      <Heading kicker={`Step ${row.number} · ${stepKind(step)}`} title={row.label} />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Started at">{formatDuration(step.startMs)}</Fact>
        <Fact label="Took">{step.type === "answer" ? "-" : formatDuration(step.durationMs)}</Fact>
        {step.type === "model" && (
          <Fact label="Tokens">{step.tokens === null ? "unknown" : fullTokens(step.tokens)}</Fact>
        )}
        <Fact label="Round">{step.round}</Fact>
        <Fact label="Result">
          <Result ok={step.ok} />
        </Fact>
      </dl>

      {step.error && <TextBlock title="Error" text={step.error} tone="bad" />}
      {step.input && (
        <TextBlock
          title={step.type === "tool" ? "Arguments" : "Input (what was new to the model)"}
          text={step.type === "tool" ? readableJson(step.input) : step.input}
        />
      )}
      {step.output && <TextBlock title={step.type === "answer" ? "Answer" : "Output"} text={step.output} />}
      {step.reasoning && (
        <details className="group flex flex-col gap-2">
          <summary className="cursor-pointer text-xs text-muted hover:text-fg">Reasoning</summary>
          <pre className="scrollbar-dark mt-2 max-h-80 overflow-auto rounded-[10px] border border-edge bg-field px-3 py-2.5 font-mono text-xs leading-[1.7] whitespace-pre-wrap wrap-break-word text-fg-faint">
            {step.reasoning}
          </pre>
        </details>
      )}
    </div>
  );
}

// Shown when the Run row is chosen: the whole run at a glance.
export function RunOverview({ run, totals }: { run: Run; totals: RunTotals }) {
  return (
    <div className="flex flex-col gap-5">
      <Heading kicker={`Run · ${run.id}`} title="Overview" />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <Fact label="Status">{statusLabel(run.status)}</Fact>
        <Fact label="Took">{formatDuration(totals.durationMs)}</Fact>
        <Fact label="Tokens">{fullTokens(totals.tokens)}</Fact>
        <Fact label="Model calls">{totals.modelCalls}</Fact>
        <Fact label="Tool calls">{totals.toolCalls}</Fact>
        <Fact label="Failed tool calls">{totals.failedToolCalls}</Fact>
        <Fact label="Model">
          <span className="font-mono text-xs break-all">{run.model}</span>
        </Fact>
        <Fact label="Prompt">{run.promptVersion}</Fact>
        <Fact label="Started">
          {/* The browser's own time zone, which can differ from the server's. */}
          <time dateTime={run.startedAt} suppressHydrationWarning>
            {new Date(run.startedAt).toLocaleString()}
          </time>
        </Fact>
      </dl>

      {run.answer !== null && <TextBlock title="Answer" text={run.answer} markdown />}
      {run.error !== null && <TextBlock title="Error" text={run.error} tone="bad" />}
      <p className="text-xs leading-relaxed text-muted">Pick a step in the timeline to see everything about it.</p>
    </div>
  );
}
