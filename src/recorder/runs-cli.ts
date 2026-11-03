import { countLabel } from "../lib/format";
import { formatRunList } from "./print";
import { listRuns } from "./store";

async function main(): Promise<number> {
  const { runs, unreadable } = await listRuns();
  console.log(formatRunList(runs));

  if (unreadable.length > 0) {
    console.log(
      `\nSkipped ${countLabel(unreadable.length, "file")} in runs/ that couldn't be read: ${unreadable.join(", ")}`,
    );
  }

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
