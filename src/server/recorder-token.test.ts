import { describe, expect, it } from "vitest";
import { checkRecorderToken } from "./recorder-token";

const TOKEN = "a-long-test-token-123456";

describe("checkRecorderToken", () => {
  it("accepts the right token", () => {
    expect(checkRecorderToken(TOKEN, TOKEN)).toBe("ok");
  });

  it("refuses a wrong token, even one of the same length", () => {
    expect(checkRecorderToken("a-long-test-token-654321", TOKEN)).toBe("wrong");
    expect(checkRecorderToken("short", TOKEN)).toBe("wrong");
  });

  it("refuses a request with no token", () => {
    expect(checkRecorderToken(null, TOKEN)).toBe("missing");
    expect(checkRecorderToken("", TOKEN)).toBe("missing");
  });

  it.each([undefined, "", "too-short"])(
    "turns writes off when the server's token is %j",
    (serverToken) => {
      expect(checkRecorderToken(TOKEN, serverToken)).toBe("not_configured");
      expect(checkRecorderToken(serverToken ?? null, serverToken)).toBe("not_configured");
    },
  );
});
