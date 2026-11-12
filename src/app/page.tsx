import { isDemo } from "@/lib/demo";

export default function Home() {
  return (
    <main className="flex w-full min-w-0 items-center justify-center px-7 py-16 md:w-auto md:flex-1">
      <div className="flex max-w-sm flex-col gap-2 text-center">
        <h1 className="font-display text-lg font-semibold tracking-[-0.015em]">Pick a run on the left</h1>
        {isDemo() ? (
          <p className="leading-relaxed text-muted">
            Its steps show here as a timeline. These runs were recorded earlier from a practice coding agent, mistakes
            included.
          </p>
        ) : (
          <p className="leading-relaxed text-muted">
            Its steps show here as a timeline. No runs yet? Start the server with{" "}
            <code className="font-mono text-xs text-fg-soft">npm run dev</code>, then run{" "}
            <code className="font-mono text-xs text-fg-soft">npm run agent -- &quot;your question&quot;</code>.
          </p>
        )}
      </div>
    </main>
  );
}
