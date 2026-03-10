import { describe, expect, it } from "vitest";

import { formatDateKey, getRangeWindow, startOfUtcDay } from "../src/lib/time.js";

describe("getRangeWindow", () => {
  it("returns a previous window for comparison", () => {
    const { start, end, previousStart } = getRangeWindow("7d");

    expect(start.getTime()).toBeGreaterThan(previousStart.getTime());
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });
});

describe("time utilities", () => {
  it("formats a timezone-aware date key", () => {
    expect(formatDateKey("2026-03-10T23:30:00Z", "America/New_York")).toBe(
      "2026-03-10",
    );
  });

  it("normalizes a date to the UTC day boundary", () => {
    const result = startOfUtcDay(new Date("2026-03-10T18:42:11Z"));

    expect(result.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });
});
