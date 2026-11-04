"use client";

import { useEffect } from "react";

// Shown when a page can't load, for example when the database is unreachable.
// The error's own text stays in the console: it can include database details.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex w-full min-w-0 items-center justify-center px-7 py-16 md:w-auto md:flex-1">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <h1 className="font-display text-lg font-semibold tracking-[-0.015em]">Couldn&apos;t load this page</h1>
        <p className="leading-relaxed text-muted">Is the database reachable? Check the server&apos;s terminal for the reason.</p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-2 h-8 rounded-lg border border-edge-strong px-3 text-[12.5px] text-fg-dim hover:text-fg"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
