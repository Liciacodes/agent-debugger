import Link from "next/link";

// The top bar. The search, the tests count and "Run all" from the design stay
// hidden until those features exist.
export function AppHeader() {
  return (
    <header className="flex h-13 shrink-0 items-center gap-2.5 border-b border-line px-4">
      <Link
        href="/"
        className="flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-model"
      >
        <span className="inline-flex size-6.5 items-center justify-center rounded-lg bg-fg">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="text-page" aria-hidden="true">
            <path d="M5 7h9M5 12h14M5 17h6" />
          </svg>
        </span>
        <span className="font-display text-sm font-bold tracking-[-0.01em]">Agent debugger</span>
      </Link>
      <span className="text-quiet" aria-hidden="true">/</span>
    
      <span className="text-fg-dim">code-helper</span>
      <span className="rounded-[5px] border border-edge-strong bg-raised px-1.75 py-0.5 text-[11px] text-muted">local</span>
    </header>
  );
}
