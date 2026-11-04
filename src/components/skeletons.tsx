function Block({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-md bg-chip ${className}`} />;
}

export function RunListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading runs" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between px-1.5">
        <h2 className="font-display text-[15px] font-semibold tracking-[-0.01em]">Runs</h2>
      </div>
      <div className="flex gap-1.5 px-1.5">
        <Block className="h-6.5 w-10 rounded-full" />
        <Block className="h-6.5 w-20 rounded-full" />
      </div>
      <div className="flex flex-col gap-0.5">
        {[0, 1, 2, 3, 4].map((index) => (
          <div key={index} className="grid grid-cols-[18px_minmax(0,1fr)_auto] gap-2 px-2.5 py-2.75">
            <Block className="size-4 rounded-full" />
            <span className="flex flex-col gap-2">
              <Block className="h-3.5 w-11/12" />
              <Block className="h-3 w-1/2" />
            </span>
            <Block className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RunSkeleton() {
  return (
    <>
      <main aria-busy="true" aria-label="Loading the run" className="flex w-full min-w-0 flex-col gap-5 px-4 py-5 sm:px-7 sm:py-6 md:w-auto md:flex-1">
        <div className="flex items-start gap-3.5">
          <Block className="size-10 rounded-[11px]" />
          <span className="flex flex-1 flex-col gap-2.5">
            <Block className="h-6 w-2/3" />
            <Block className="h-3.5 w-1/3" />
          </span>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-edge bg-card">
          <div className="border-b border-line px-4 py-3">
            <Block className="h-3 w-16" />
          </div>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <div key={index} className="grid h-10 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] items-center gap-4 px-4">
              <Block className="h-3.5 w-1/2" />
              <Block className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      </main>
      <aside className="w-full border-t border-line bg-side px-4 py-6 sm:px-5.5 xl:w-95 xl:shrink-0 xl:border-t-0 xl:border-l">
        <span className="flex flex-col gap-3">
          <Block className="h-3 w-24" />
          <Block className="h-5 w-40" />
          <Block className="mt-3 h-24 w-full" />
        </span>
      </aside>
    </>
  );
}
