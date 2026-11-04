import Link from "next/link";

export default function RunNotFound() {
  return (
    <main className="flex w-full min-w-0 items-center justify-center px-7 py-16 md:w-auto md:flex-1">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <h1 className="font-display text-lg font-semibold tracking-[-0.015em]">No run with that id</h1>
        <p className="leading-relaxed text-muted">It may have been deleted, or the link has a typo.</p>
        <Link href="/" className="mt-2 text-model hover:text-model-strong">
          Back to runs
        </Link>
      </div>
    </main>
  );
}
