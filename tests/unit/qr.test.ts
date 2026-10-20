import { describe, expect, it } from "vitest";
import { encodeQr, MIN_TOKEN_LENGTH, newQrToken, parseQr } from "../../src/lib/qr";

describe("qr payload", () => {
  it("round-trips a generated token", () => {
    const t = newQrToken();
    expect(t.length).toBeGreaterThanOrEqual(MIN_TOKEN_LENGTH);
    expect(parseQr(encodeQr(t))).toBe(t);
  });
  it("tokens are unique", () => expect(newQrToken()).not.toBe(newQrToken()));
  it("rejects foreign, short or malformed codes", () => {
    expect(parseQr("https://example.com")).toBeNull();
    expect(parseQr("shiftline:v1:short")).toBeNull();
    expect(parseQr("shiftline:v2:" + "a".repeat(40))).toBeNull();
    expect(parseQr("shiftline:v1:" + "a b".repeat(20))).toBeNull();
    expect(parseQr(null)).toBeNull();
  });
});
