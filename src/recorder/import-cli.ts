import { loadEnvFiles } from "../lib/env";
import { countLabel } from "../lib/format";
import { DEFAULT_RECORDER_URL, importRuns, sendRun } from "./send";
import { listRuns } from "./store";

async function main(): Promise<number> {
  loadEnvFiles();
  const url = process.env.RECORDER_URL || DEFAULT_RECORDER_URL;
  const token = process.env.RECORDER_TOKEN;
  const { runs, unreadable } = await listRuns();

  if (unreadable.length > 0) {
    console.log(`Skipping ${countLabel(unreadable.length, "file")} that couldn't be read: ${unreadable.join(", ")}`);
  }

  if (runs.length === 0) {
    console.log("No saved runs in runs/ to import.");
    return 0;
  }

  console.log(`Importing ${countLabel(runs.length, "run")} into ${url}`);
  const tally = await importRuns(runs, (run) => sendRun(run, { url, token }));

  console.log(
    `stored ${tally.stored}, already stored ${tally.alreadyStored}, failed ${tally.failed.length}`,
  );

  for (const { id, reason } of tally.failed) {
    console.log(`  ${id}: ${reason}`);
  }

  if (tally.notTried > 0) {
    console.log(`Stopped early: ${countLabel(tally.notTried, "run")} not tried.`);
  }

  return tally.failed.length > 0 ? 1 : 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
