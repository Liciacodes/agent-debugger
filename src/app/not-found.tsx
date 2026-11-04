import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex w-full min-w-0 items-center justify-center px-7 py-16 md:w-auto md:flex-1">
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <h1 className="font-display text-lg font-semibold tracking-[-0.015em]">Page not found</h1>
        <Link href="/" className="mt-2 text-model hover:text-model-strong">
          Back to runs
        </Link>
      </div>
    </main>
  );
}
