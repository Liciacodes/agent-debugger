import { describe, expect, it } from "vitest";
import { login } from "./auth";

describe("login", () => {
  it("accepts the right password", () => {
    expect(login("ada@example.com", "correct-horse")).toEqual({ ok: true });
  });

  it("rejects the wrong password", () => {
    expect(login("ada@example.com", "nope").ok).toBe(false);
  });

  it("rejects an unknown email", () => {
    expect(login("nobody@example.com", "correct-horse").ok).toBe(false);
  });
});
