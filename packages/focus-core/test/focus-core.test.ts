import { describe, expect, it } from "vitest";

import {
  calculateFragmentation,
  createFocusSnapshot,
  focusSnapshotSchema,
  getBurnoutAssessment,
  getDailyFocusMetrics,
  getDeepWorkBlocks,
  normalizeTrackableUrl,
  categorizeUrl,
  type DailyFocusMetrics,
  type FocusSession,
} from "../src/index.js";

function createSession(
  id: string,
  url: string,
  category: FocusSession["category"],
  intent: FocusSession["intent"],
  startTime: string,
  endTime: string,
): FocusSession {
  const normalized = normalizeTrackableUrl(url);

  if (!normalized) {
    throw new Error(`Untrackable URL: ${url}`);
  }

  return {
    id,
    ...normalized,
    category,
    intent,
    startTime,
    endTime,
    durationSeconds:
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000,
  };
}

describe("focus-core", () => {
  it("normalizes trackable URLs without query strings or hashes", () => {
    const normalized = normalizeTrackableUrl(
      "https://github.com/user/repo/pulls?tab=active#filters",
    );

    expect(normalized).toEqual({
      origin: "https://github.com",
      path: "/user/repo/pulls",
      hostname: "github.com",
    });
  });

  it("categorizes known coding and entertainment domains", () => {
    const github = categorizeUrl({
      origin: "https://github.com",
      path: "/openai/codex",
      hostname: "github.com",
    });
    const youtube = categorizeUrl({
      origin: "https://www.youtube.com",
      path: "/watch",
      hostname: "www.youtube.com",
    });

    expect(github.category).toBe("coding");
    expect(github.intent).toBe("productive");
    expect(youtube.category).toBe("entertainment");
    expect(youtube.intent).toBe("distracting");
  });

  it("counts category switches for the fragmentation matrix", () => {
    const sessions = [
      createSession(
        "1",
        "https://github.com/openai/codex",
        "coding",
        "productive",
        "2026-03-10T09:00:00.000Z",
        "2026-03-10T09:20:00.000Z",
      ),
      createSession(
        "2",
        "https://www.youtube.com/watch",
        "entertainment",
        "distracting",
        "2026-03-10T09:20:10.000Z",
        "2026-03-10T09:35:00.000Z",
      ),
      createSession(
        "3",
        "https://github.com/openai/codex/issues",
        "coding",
        "productive",
        "2026-03-10T09:35:10.000Z",
        "2026-03-10T10:05:00.000Z",
      ),
    ];

    const result = calculateFragmentation(sessions, "2026-03-10");

    expect(result.totalSwitches).toBe(2);
    expect(result.matrix).toEqual([
      { from: "coding", to: "entertainment", count: 1 },
      { from: "entertainment", to: "coding", count: 1 },
    ]);
  });

  it("merges adjacent productive sessions into one deep work block", () => {
    const sessions = [
      createSession(
        "1",
        "https://github.com/openai/codex",
        "coding",
        "productive",
        "2026-03-11T13:00:00.000Z",
        "2026-03-11T13:16:00.000Z",
      ),
      createSession(
        "2",
        "https://developer.mozilla.org/en-US/docs/Web/API",
        "docs",
        "productive",
        "2026-03-11T13:16:30.000Z",
        "2026-03-11T13:35:30.000Z",
      ),
    ];

    const blocks = getDeepWorkBlocks(sessions, "2026-03-11");

    expect(blocks).toHaveLength(1);
    expect(blocks[0].durationMinutes).toBe(35.5);
    expect(blocks[0].categories).toEqual(["coding", "docs"]);
  });

  it("scores burnout levels across rolling windows", () => {
    const metrics: DailyFocusMetrics[] = [
      {
        date: "2026-03-01",
        activeMinutes: 180,
        productiveMinutes: 120,
        deepWorkMinutes: 100,
        shallowWorkMinutes: 80,
        fragmentationScore: 1.2,
        categorySwitches: 3,
      },
      {
        date: "2026-03-02",
        activeMinutes: 190,
        productiveMinutes: 110,
        deepWorkMinutes: 90,
        shallowWorkMinutes: 100,
        fragmentationScore: 1.1,
        categorySwitches: 4,
      },
      {
        date: "2026-03-03",
        activeMinutes: 200,
        productiveMinutes: 100,
        deepWorkMinutes: 80,
        shallowWorkMinutes: 120,
        fragmentationScore: 1.3,
        categorySwitches: 4,
      },
      {
        date: "2026-03-04",
        activeMinutes: 260,
        productiveMinutes: 95,
        deepWorkMinutes: 50,
        shallowWorkMinutes: 210,
        fragmentationScore: 1.8,
        categorySwitches: 6,
      },
      {
        date: "2026-03-05",
        activeMinutes: 280,
        productiveMinutes: 90,
        deepWorkMinutes: 45,
        shallowWorkMinutes: 235,
        fragmentationScore: 2,
        categorySwitches: 7,
      },
      {
        date: "2026-03-06",
        activeMinutes: 300,
        productiveMinutes: 85,
        deepWorkMinutes: 40,
        shallowWorkMinutes: 260,
        fragmentationScore: 2.1,
        categorySwitches: 8,
      },
    ];

    const result = getBurnoutAssessment(metrics);

    expect(result.level).toBe("critical");
    expect(result.signals.every((signal) => signal.triggered)).toBe(true);
  });

  it("returns warming up when fewer than six days exist", () => {
    const result = getBurnoutAssessment(
      getDailyFocusMetrics([
        createSession(
          "1",
          "https://github.com/openai/codex",
          "coding",
          "productive",
          "2026-03-07T09:00:00.000Z",
          "2026-03-07T09:45:00.000Z",
        ),
      ]),
    );

    expect(result.level).toBe("warming_up");
  });

  it("creates a schema-valid snapshot payload", () => {
    const sessions = [
      createSession(
        "1",
        "https://github.com/openai/codex",
        "coding",
        "productive",
        "2026-03-08T09:00:00.000Z",
        "2026-03-08T09:30:00.000Z",
      ),
    ];

    const snapshot = createFocusSnapshot(sessions, {
      exportedAt: "2026-03-08T10:00:00.000Z",
      timezone: "America/New_York",
    });
    const parsed = focusSnapshotSchema.parse(snapshot);

    expect(parsed.sessions).toHaveLength(1);
    expect(parsed.version).toBe(1);
  });
});
