import { formatRunTree, formatTotals } from "./print";
import { loadRun } from "./store";
import { computeTotals } from "./totals";

async function main(): Promise<number> {
  const id = (process.argv[2] ?? "").trim();

  if (id === "") {
    console.error("Usage: npm run show -- <run id>   (see the ids with: npm run runs)");
    return 1;
  }

  const run = await loadRun(id);
  console.log(`${formatRunTree(run)}\n`);
  // Printed last: until computeTotals is written, it stops here with a message.
  console.log(formatTotals(computeTotals(run)));
  return 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
