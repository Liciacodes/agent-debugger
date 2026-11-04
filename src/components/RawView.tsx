"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import type { Run } from "@/recorder/types";

type CopyState = "idle" | "copied" | "failed";


const RESET_AFTER_MS = 2_000;

const BUTTON_TEXT: Record<CopyState, string> = {
  idle: "Copy",
  copied: "Copied",
  failed: "Couldn't copy",
};


export function RawView({ run }: { run: Run }) {
  const json = JSON.stringify(run, null, 2);
  const [copyState, setCopyState] = useState<CopyState>("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const timer = setTimeout(() => setCopyState("idle"), RESET_AFTER_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopyState("copied");
    } catch {
      // The browser can refuse, for example on a page that isn't https.
      setCopyState("failed");
    }
  }

  const Icon = copyState === "copied" ? Check : Copy;

  return (
    <div className="relative">
      {/* Outside the scrolling box, so it stays in the corner while you scroll. */}
      <button
        type="button"
        onClick={copy}
        className={`absolute top-2.5 right-2.5 inline-flex h-7 items-center gap-1.5 rounded-md border border-edge-strong bg-field px-2.5 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-model ${
          copyState === "copied" ? "text-ok-soft" : copyState === "failed" ? "text-bad-soft" : "text-fg-dim hover:text-fg"
        }`}
      >
        <Icon className="size-3.5" strokeWidth={2} aria-hidden="true" />
        {/* Read out when it changes, so screen readers hear "Copied" too. */}
        <span aria-live="polite">{BUTTON_TEXT[copyState]}</span>
      </button>
      <pre className="scrollbar-dark overflow-auto rounded-[14px] border border-edge bg-card p-4 font-mono text-xs leading-relaxed text-fg-soft">
        {json}
      </pre>
    </div>
  );
}
