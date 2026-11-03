import { realpath } from "node:fs/promises";
import path from "node:path";
import { ToolError } from "./types";

const NOT_ALLOWED =
  "Path not allowed. Use a path relative to the project root, inside the project.";

function isInside(root: string, target: string): boolean {
  const relative = path.relative(root, target);

  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

// The one gate every tool path goes through. It returns the real location on
// disk, or throws a ToolError if the path would leave the project.
export async function resolveSafePath(
  rootDir: string,
  userPath: string,
): Promise<{ root: string; target: string }> {
  // Treat \ as / so "..\secret" is caught the same way on every OS.
  const cleaned = userPath.replaceAll("\\", "/");

  // A colon means a Windows drive ("C:foo") or a hidden file stream, and no
  // path inside the project needs one.
  if (
    cleaned.includes("\0") ||
    cleaned.includes(":") ||
    path.isAbsolute(cleaned)
  ) {
    throw new ToolError(NOT_ALLOWED);
  }

  const root = await realpath(rootDir);
  const resolved = path.resolve(root, cleaned);

  if (!isInside(root, resolved)) {
    throw new ToolError(NOT_ALLOWED);
  }

  // Follow any links and check again: a link inside the project can point
  // outside it.
  let target: string;
  try {
    target = await realpath(resolved);
  } catch {
    throw new ToolError(`No such file or folder: ${cleaned}`);
  }

  if (!isInside(root, target)) {
    throw new ToolError(NOT_ALLOWED);
  }

  return { root, target };
}
