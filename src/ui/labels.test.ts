import { describe, expect, it } from "vitest";
import { fullTokens, isSameDay, runState, shortTokens, statusLabel, timeAgo } from "./labels";

const NOW = Date.parse("2026-11-03T14:00:00.000Z");

describe("timeAgo", () => {
  it.each([
    ["2026-11-03T13:59:30.000Z", "just now"],
    ["2026-11-03T13:58:00.000Z", "2m"],
    ["2026-11-03T12:59:00.000Z", "1h"],
    ["2026-10-31T14:00:00.000Z", "3d"],
    // A clock slightly ahead never gives a negative time.
    ["2026-11-03T14:00:05.000Z", "just now"],
  ])("shows %s as %s", (iso, expected) => {
    expect(timeAgo(iso, NOW)).toBe(expected);
  });
});

describe("isSameDay", () => {
  it("tells today from another day", () => {
    expect(isSameDay(new Date(NOW - 60_000).toISOString(), NOW)).toBe(true);
    expect(isSameDay(new Date(NOW - 3 * 86_400_000).toISOString(), NOW)).toBe(false);
  });
});

describe("run status", () => {
  it("groups every ending into answered, stopped or running", () => {
    expect(runState("answered")).toBe("answered");
    expect(runState("running")).toBe("running");
    expect(runState("max_rounds")).toBe("stopped");
    expect(runState("cut_off")).toBe("stopped");
    expect(runState("model_error")).toBe("stopped");
  });

  it("says how a run ended in words", () => {
    expect(statusLabel("answered")).toBe("Answered");
    expect(statusLabel("max_rounds")).toBe("Stopped: round limit");
  });
});

describe("token formats", () => {
  it("shortens tokens for waterfall rows", () => {
    expect(shortTokens(820)).toBe("820 tok");
    expect(shortTokens(1400)).toBe("1.4k tok");
    expect(shortTokens(null)).toBeNull();
  });

  it("writes tokens in full for the run header", () => {
    expect(fullTokens(3512)).toBe("3,512 tokens");
    expect(fullTokens(1)).toBe("1 token");
  });
});
