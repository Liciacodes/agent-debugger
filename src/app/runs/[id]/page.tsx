import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { RunView } from "@/components/RunView";
import { RunSkeleton } from "@/components/skeletons";
import { RUN_ID_PATTERN } from "@/recorder/run-id";
import { prismaStore } from "@/server/prisma-store";

type Props = PageProps<"/runs/[id]">;

export default function RunPage({ params, searchParams }: Props) {
  // The run comes from the database, so it streams in behind a skeleton.
  return (
    <Suspense fallback={<RunSkeleton />}>
      <LoadedRun params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function LoadedRun({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  await connection();
  const { id } = await params;
  const { step } = await searchParams;
  const run = RUN_ID_PATTERN.test(id) ? await prismaStore.getRun(id) : null;

  if (!run) notFound();

  // A new key for each run, so a different run starts with a fresh choice of step.
  return <RunView key={run.id} run={run} stepFromUrl={typeof step === "string" ? step : null} />;
}
