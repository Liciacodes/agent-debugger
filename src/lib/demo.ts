// True on the public demo site, where DEMO_MODE=1 is set. Visitors there can
// only look at recorded runs, so the UI says so and hides the "run it
// yourself" hints. Server-side only: client components get it as a prop.
export function isDemo(): boolean {
  return process.env.DEMO_MODE === "1";
}
