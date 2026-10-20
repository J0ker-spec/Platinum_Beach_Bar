import { describe, expect, it } from "vitest";
import { draftShiftsBetween, isSwappableShift } from "../../src/data";

describe("isSwappableShift", () => {
  const future = Date.now() + 86_400_000; // tomorrow
  const past = Date.now() - 86_400_000; // yesterday

  it("accepts a published shift that has not started yet", () => {
    expect(isSwappableShift({ status: "Published", startAt: future })).toBe(true);
  });

  describe("draftShiftsBetween", () => {
    const shifts = [
      { id: "before", date: "2026-10-11", status: "Draft" },
      { id: "start", date: "2026-10-12", status: "Draft" },
      { id: "middle", date: "2026-10-15", status: "Draft" },
      { id: "end", date: "2026-10-18", status: "Draft" },
      { id: "after", date: "2026-10-19", status: "Draft" },
      { id: "published", date: "2026-10-15", status: "Published" },
    ];

    it("includes only draft shifts from the selected inclusive week", () => {
      expect(draftShiftsBetween(shifts, "2026-10-12", "2026-10-18").map((shift) => shift.id))
        .toEqual(["start", "middle", "end"]);
    });
  });

  it("accepts updated published shifts", () => {
    expect(isSwappableShift({ status: "Updated", startAt: future })).toBe(true);
  });

  it("rejects draft and cancelled shifts", () => {
    expect(isSwappableShift({ status: "Draft", startAt: future })).toBe(false);
    expect(isSwappableShift({ status: "Cancelled", startAt: future })).toBe(false);
  });

  it("rejects shifts that have already started", () => {
    expect(isSwappableShift({ status: "Published", startAt: past })).toBe(false);
  });

  it("rejects shifts without a start timestamp", () => {
    expect(isSwappableShift({ status: "Published" })).toBe(false);
    expect(isSwappableShift({})).toBe(false);
  });
});
