import { describe, expect, it } from "vitest";

import type { FocusSession } from "../src/index.js";
import {
  calculateContextSwitchTax,
  extractCanvasCourseId,
  getEarlyBurnoutWarning,
  getCanvasCourseReport,
  isCanvasHostname,
} from "../src/index.js";

function createSession(
  id: string,
  options: {
    origin?: string;
    path?: string;
    hostname?: string;
    category: FocusSession["category"];
    intent: FocusSession["intent"];
    startTime: string;
    endTime: string;
  },
): FocusSession {
  return {
    id,
    origin: options.origin ?? "https://example.com",
    path: options.path ?? `/${options.category}/${id}`,
    hostname: options.hostname ?? "example.com",
    category: options.category,
    intent: options.intent,
    startTime: options.startTime,
    endTime: options.endTime,
    durationSeconds:
      (new Date(options.endTime).getTime() -
        new Date(options.startTime).getTime()) /
      1000,
  };
}

describe("analytics heuristics", () => {
  it("extracts Canvas course IDs from course paths", () => {
    expect(isCanvasHostname("canvas.instructure.com")).toBe(true);
    expect(extractCanvasCourseId("/courses/101/modules")).toBe("101");
    expect(extractCanvasCourseId("/calendar")).toBeNull();
  });

  it("returns a zero context-switch tax for a safe focus block", () => {
    const sessions = [
      createSession("1", {
        hostname: "canvas.instructure.com",
        origin: "https://canvas.instructure.com",
        path: "/courses/101/modules",
        category: "learning",
        intent: "productive",
        startTime: "2026-03-10T09:00:00.000Z",
        endTime: "2026-03-10T09:45:00.000Z",
      }),
      createSession("2", {
        hostname: "canvas.instructure.com",
        origin: "https://canvas.instructure.com",
        path: "/courses/101/grades",
        category: "learning",
        intent: "productive",
        startTime: "2026-03-10T09:45:10.000Z",
        endTime: "2026-03-10T10:30:00.000Z",
      }),
    ];

    expect(calculateContextSwitchTax(sessions)).toBe(0);
  });

  it("keeps the early burnout warning in the safe zone for stable focus", () => {
    const sessions = [
      createSession("1", {
        origin: "https://github.com",
        hostname: "github.com",
        path: "/openai/codex",
        category: "coding",
        intent: "productive",
        startTime: "2026-03-10T09:00:00.000Z",
        endTime: "2026-03-10T10:30:00.000Z",
      }),
      createSession("2", {
        origin: "https://github.com",
        hostname: "github.com",
        path: "/openai/codex/pulls",
        category: "coding",
        intent: "productive",
        startTime: "2026-03-10T10:30:10.000Z",
        endTime: "2026-03-10T12:00:00.000Z",
      }),
    ];

    expect(getEarlyBurnoutWarning(sessions)).toMatchObject({
      level: "Safe",
      warmingUp: false,
      message: "Good focus rhythm.",
      triggeredSignalKeys: [],
    });
  });

  it("measures stacked context-switch tax during micro-tasking bursts", () => {
    const sessions = [
      createSession("1", {
        origin: "https://github.com",
        hostname: "github.com",
        path: "/openai/codex",
        category: "coding",
        intent: "productive",
        startTime: "2026-03-11T09:00:00.000Z",
        endTime: "2026-03-11T09:00:30.000Z",
      }),
      createSession("2", {
        origin: "https://mail.google.com",
        hostname: "mail.google.com",
        path: "/mail/u/0",
        category: "communication",
        intent: "neutral",
        startTime: "2026-03-11T09:00:30.000Z",
        endTime: "2026-03-11T09:01:00.000Z",
      }),
      createSession("3", {
        origin: "https://google.com",
        hostname: "google.com",
        path: "/search",
        category: "search",
        intent: "productive",
        startTime: "2026-03-11T09:01:00.000Z",
        endTime: "2026-03-11T09:01:30.000Z",
      }),
      createSession("4", {
        origin: "https://developer.mozilla.org",
        hostname: "developer.mozilla.org",
        path: "/en-US/docs/Web/API",
        category: "docs",
        intent: "productive",
        startTime: "2026-03-11T09:01:30.000Z",
        endTime: "2026-03-11T09:02:00.000Z",
      }),
    ];

    expect(calculateContextSwitchTax(sessions)).toBe(9);
  });

  it("raises an early warning when medium switching tax accumulates", () => {
    const sessions = [
      createSession("1", {
        origin: "https://github.com",
        hostname: "github.com",
        path: "/openai/codex",
        category: "coding",
        intent: "productive",
        startTime: "2026-03-12T09:00:00.000Z",
        endTime: "2026-03-12T09:02:00.000Z",
      }),
      createSession("2", {
        origin: "https://developer.mozilla.org",
        hostname: "developer.mozilla.org",
        path: "/en-US/docs/Web/API",
        category: "docs",
        intent: "productive",
        startTime: "2026-03-12T09:02:00.000Z",
        endTime: "2026-03-12T09:04:00.000Z",
      }),
    ];

    expect(getEarlyBurnoutWarning(sessions)).toMatchObject({
      level: "Warning",
      warmingUp: false,
      message: "High context switching detected. Cognitive tax is accumulating.",
    });
  });

  it("flags severe burnout when micro-tasking bursts exceed the rolling window threshold", () => {
    const sessions: FocusSession[] = [];
    let startAt = new Date("2026-03-13T09:00:00.000Z");

    for (let index = 0; index < 22; index += 1) {
      const endAt = new Date(startAt.getTime() + 30 * 1000);
      const courseId = index % 2 === 0 ? "101" : "202";

      sessions.push(
        createSession(String(index + 1), {
          origin: "https://canvas.instructure.com",
          hostname: "canvas.instructure.com",
          path: `/courses/${courseId}/modules`,
          category: "learning",
          intent: "productive",
          startTime: startAt.toISOString(),
          endTime: endAt.toISOString(),
        }),
      );

      startAt = endAt;
    }

    sessions.push(
      createSession("23", {
        origin: "https://canvas.instructure.com",
        hostname: "canvas.instructure.com",
        path: "/courses/202/modules",
        category: "learning",
        intent: "productive",
        startTime: startAt.toISOString(),
        endTime: new Date(startAt.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      }),
    );

    expect(getEarlyBurnoutWarning(sessions)).toMatchObject({
      level: "Critical",
      warmingUp: false,
      message:
        "Severe Context Switching Tax. Brain is fragmented. Take a 15-minute screen break immediately.",
    });
  });

  it("builds a Canvas course report with interruptions and fast returns", () => {
    const sessions = [
      createSession("1", {
        origin: "https://canvas.instructure.com",
        hostname: "canvas.instructure.com",
        path: "/courses/101/modules",
        category: "learning",
        intent: "productive",
        startTime: "2026-03-13T09:00:00.000Z",
        endTime: "2026-03-13T09:30:00.000Z",
      }),
      createSession("2", {
        origin: "https://youtube.com",
        hostname: "youtube.com",
        path: "/watch",
        category: "entertainment",
        intent: "distracting",
        startTime: "2026-03-13T09:30:00.000Z",
        endTime: "2026-03-13T09:30:20.000Z",
      }),
      createSession("3", {
        origin: "https://canvas.instructure.com",
        hostname: "canvas.instructure.com",
        path: "/courses/101/grades",
        category: "learning",
        intent: "productive",
        startTime: "2026-03-13T09:30:20.000Z",
        endTime: "2026-03-13T10:00:00.000Z",
      }),
      createSession("4", {
        origin: "https://canvas.instructure.com",
        hostname: "canvas.instructure.com",
        path: "/courses/202/modules",
        category: "learning",
        intent: "productive",
        startTime: "2026-03-13T10:15:00.000Z",
        endTime: "2026-03-13T11:15:00.000Z",
      }),
    ];

    const report = getCanvasCourseReport({
      version: 1,
      exportedAt: "2026-03-13T11:15:00.000Z",
      timezone: "America/New_York",
      sessions,
    });
    const course101 = report.courses.find((course) => course.courseId === "101");

    expect(report.totalCourseCount).toBe(2);
    expect(course101).toMatchObject({
      courseId: "101",
      sessionCount: 2,
      switchOutCount: 2,
      distractingSwitchCount: 1,
      fastSwitchCount: 1,
      returnToCourseCount: 1,
    });
    expect(course101?.topDistractionHosts[0]).toMatchObject({
      hostname: "youtube.com",
    });
    expect(course101?.interruptions[0]).toMatchObject({
      hostname: "youtube.com",
      returnedToCourse: true,
      fastSwitch: true,
    });
  });
});
