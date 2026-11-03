import { createHash, timingSafeEqual } from "node:crypto";

export const RECORDER_TOKEN_HEADER = "x-recorder-token";

// A short token is easy to guess, so the server treats it as not set.
const MIN_TOKEN_LENGTH = 16;

export type TokenCheck = "ok" | "missing" | "wrong" | "not_configured";

function fingerprint(text: string): Buffer {
  return createHash("sha256").update(text).digest();
}

// Compares fingerprints of the two tokens. They always have the same length,
// and timingSafeEqual takes the same time whether they match or not, so timing
// the server's answers can't reveal the token bit by bit.
export function checkRecorderToken(
  sent: string | null,
  expected: string | undefined,
): TokenCheck {
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return "not_configured";
  if (!sent) return "missing";
  return timingSafeEqual(fingerprint(sent), fingerprint(expected)) ? "ok" : "wrong";
}
