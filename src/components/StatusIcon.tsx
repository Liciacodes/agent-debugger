import { Check, CircleCheck, CircleX, Clock, X } from "lucide-react";
import type { Run } from "@/recorder/types";
import { runState, statusLabel } from "@/ui/labels";

const CIRCLED = { answered: CircleCheck, stopped: CircleX, running: Clock };
const PLAIN = { answered: Check, stopped: X, running: Clock };
const COLOURS = { answered: "text-ok", stopped: "text-bad", running: "text-warn" };
const BOXES = {
  answered: "border-ok-edge bg-ok-tint",
  stopped: "border-bad-edge bg-bad-tint",
  running: "border-edge-strong bg-field",
};

// A small round icon for the runs list. The words are there for screen
// readers, so the colour is never the only signal.
export function StatusIcon({ status, className = "" }: { status: Run["status"]; className?: string }) {
  const state = runState(status);
  const Icon = CIRCLED[state];

  return (
    <>
      <Icon className={`${COLOURS[state]} ${className}`} strokeWidth={2.2} aria-hidden="true" />
      <span className="sr-only">{statusLabel(status)}</span>
    </>
  );
}

// The bigger boxed icon next to a run's title.
export function StatusBadge({ status }: { status: Run["status"] }) {
  const state = runState(status);
  const Icon = PLAIN[state];

  return (
    <span
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-[11px] border ${BOXES[state]}`}
    >
      <Icon className={`size-4.5 ${COLOURS[state]}`} strokeWidth={2.2} aria-hidden="true" />
    </span>
  );
}
