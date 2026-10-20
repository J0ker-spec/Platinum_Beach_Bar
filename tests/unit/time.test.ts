import { describe, expect, it } from "vitest";
import { normalizeTime, repeatDates } from "../../src/lib/time";

describe("normalizeTime", () => {
  it.each([["9", "9:00 AM"], ["930a", "9:30 AM"], ["14:30", "2:30 PM"], ["9:30 pm", "9:30 PM"], ["12am", "12:00 AM"], ["0:15", "12:15 AM"]])("%s -> %s", (i, o) =>
    expect(normalizeTime(i)).toBe(o));
  it.each(["", "25", "9:75", "13pm", "abc"])("rejects %s", (i) => expect(normalizeTime(i)).toBeNull());
});

describe("repeatDates", () => {
  it("lists chosen weekdays across weeks", () => {
    expect(repeatDates("2026-10-19", 2, [1, 3])).toEqual(["2026-10-19", "2026-10-21", "2026-10-26", "2026-10-28"]);
  });
});
