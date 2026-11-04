import { List } from "lucide-react";
import Link from "next/link";


export function NavRail() {
  return (
    <nav
      aria-label="Sections"
      className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-line px-2 py-3 md:flex"
    >
      <Link
        href="/"
        aria-label="Runs"
        className="inline-flex size-10 items-center justify-center rounded-[10px] border border-nav-edge bg-nav text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-model"
      >
        <List className="size-4.5" strokeWidth={1.8} aria-hidden="true" />
      </Link>
    </nav>
  );
}
