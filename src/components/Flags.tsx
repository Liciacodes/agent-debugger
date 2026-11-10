import { TriangleAlert, X } from "lucide-react";
import type { Flag } from "@/flags/types";
import { flagTitle } from "@/ui/flags";
import { FormattedText } from "./FormattedText";

const PILL_COLOURS: Record<Flag["severity"], string> = {
  error: "border-bad-edge bg-bad-tint text-bad-soft",
  warning: "border-warn-edge bg-warn-tint text-warn-soft",
};

// The pills under the run's title, styled like the design's check pills. Each
// opens the step it points at, or the run overview for a whole-run flag.
export function FlagPills({ flags, onChoose }: { flags: Flag[]; onChoose: (stepId: string | null) => void }) {
  if (flags.length === 0) return null;

  return (
    <ul aria-label="Flags" className="flex flex-wrap gap-2">
      {flags.map((flag) => {
        const Icon = flag.severity === "error" ? X : TriangleAlert;

        return (
          <li key={`${flag.kind}-${flag.stepId}`}>
            <button
              type="button"
              onClick={() => onChoose(flag.stepId)}
              className={`inline-flex h-7 items-center gap-1.75 rounded-full border px-2.75 text-xs hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-model ${PILL_COLOURS[flag.severity]}`}
            >
              <Icon
                className={`size-3 shrink-0 ${flag.severity === "error" ? "text-bad" : "text-warn"}`}
                strokeWidth={2.8}
                aria-hidden="true"
              />
              {flagTitle(flag)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// The design's "What went wrong": one plain sentence per flag.
export function WhatWentWrong({ flags }: { flags: Flag[] }) {
  if (flags.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs text-muted">What went wrong</h3>
      {flags.map((flag) => (
        <p key={flag.kind} className="leading-[1.6] text-fg-soft">
          <FormattedText text={flag.message} />
        </p>
      ))}
    </section>
  );
}
