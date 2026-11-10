import type { Step } from "../recorder/types";


export function findRepeatedCalls(steps: Step[]): string[] {
  const seen = new Set<string>();
  const repeats: string[] = [];
  for (const step of steps) {
    if (step.type !== "tool") continue;

    const fingerprint = `${step.name} ${step.input}`;
    if (seen.has(fingerprint)) {
      repeats.push(step.id);
    } else {
      seen.add(fingerprint);
    }
  }
  return repeats;
}
