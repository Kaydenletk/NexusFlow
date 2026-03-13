import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChromeDashboard } from "./chrome-dashboard";

vi.mock("@tremor/react", () => ({
  BarChart: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
  BarList: ({
    data,
  }: {
    data: Array<{ name: string; value: number }>;
  }) => (
    <ul>
      {data.map((item) => (
        <li key={item.name}>
          {item.name}:{item.value}
        </li>
      ))}
    </ul>
  ),
  LineChart: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
}));

describe("ChromeDashboard", () => {
  it("renders focus metrics, switching pressure, and time-per-tab labels", () => {
    render(
      <ChromeDashboard
        health={{
          status: "ok",
          database: "ok",
          timestamp: "2026-03-13T18:00:00.000Z",
          totalSessions: 6,
          lastSyncAt: "2026-03-13T17:24:28.324Z",
          privacyRuleCount: 8,
        }}
        overview={{
          range: "7d",
          metrics: {
            trackedHours: 2.87,
            productiveRatio: 0.92,
            distractingRatio: 0.01,
            switchCount: 5,
            switchTax: 8,
            activeDays: 1,
            syncedSessionCount: 6,
            burnoutLevel: "Warming up",
          },
          daily: [
            {
              date: "2026-03-13",
              trackedMinutes: 172,
              productiveMinutes: 158,
              distractingMinutes: 2,
              switchCount: 5,
              switchTax: 8,
            },
          ],
          lastSyncAt: "2026-03-13T17:24:28.324Z",
        }}
        hosts={{
          range: "7d",
          items: [
            { hostname: "canvas.instructure.com", durationMinutes: 108, sessionCount: 3, distractingMinutes: 0, isMostlyMasked: false },
            { hostname: "mail.google.com", durationMinutes: 12, sessionCount: 1, distractingMinutes: 0, isMostlyMasked: true },
          ],
        }}
        categories={{
          range: "7d",
          items: [
            { category: "learning", durationMinutes: 108, sessionCount: 3 },
            { category: "coding", durationMinutes: 50, sessionCount: 2 },
          ],
        }}
        context={{
          range: "7d",
          burnoutLevel: "Warming up",
          items: [
            {
              date: "2026-03-13",
              switchCount: 5,
              switchTax: 8,
              fragmentationScore: 2.5,
            },
          ],
        }}
        timeline={{
          date: "2026-03-13",
          switchCount: 5,
          switchTax: 8,
          focusBlocks: [
            {
              startTime: "2026-03-13T12:00:00.000Z",
              endTime: "2026-03-13T13:05:00.000Z",
              durationMinutes: 65,
              categories: ["learning"],
            },
          ],
          items: [
            {
              id: "session-1",
              tabId: 1,
              windowId: 1,
              origin: "https://canvas.instructure.com",
              path: "/courses/101/modules",
              hostname: "canvas.instructure.com",
              documentTitle: "Course 101 Modules",
              category: "learning",
              intent: "productive",
              eventReason: "activated",
              isPathMasked: false,
              startTime: "2026-03-13T12:00:00.000Z",
              endTime: "2026-03-13T12:35:00.000Z",
              durationSeconds: 2100,
              createdAt: "2026-03-13T17:24:28.346Z",
            },
          ],
        }}
        sessions={{
          range: "7d",
          items: [
            {
              id: "session-1",
              tabId: 1,
              windowId: 1,
              origin: "https://canvas.instructure.com",
              path: "/courses/101/modules",
              hostname: "canvas.instructure.com",
              documentTitle: "Course 101 Modules",
              category: "learning",
              intent: "productive",
              eventReason: "activated",
              isPathMasked: false,
              startTime: "2026-03-13T12:00:00.000Z",
              endTime: "2026-03-13T12:35:00.000Z",
              durationSeconds: 2100,
              createdAt: "2026-03-13T17:24:28.346Z",
            },
            {
              id: "session-2",
              tabId: 2,
              windowId: 1,
              origin: "https://mail.google.com",
              path: "/__masked__",
              hostname: "mail.google.com",
              documentTitle: null,
              category: "communication",
              intent: "neutral",
              eventReason: "updated",
              isPathMasked: true,
              startTime: "2026-03-13T14:00:00.000Z",
              endTime: "2026-03-13T14:12:00.000Z",
              durationSeconds: 720,
              createdAt: "2026-03-13T17:24:28.346Z",
            },
          ],
        }}
        canvasReport={{
          fastSwitchThresholdSeconds: 30,
          totalCanvasMinutes: 108,
          totalCourseCount: 1,
          courses: [
            {
              courseId: "101",
              totalMinutes: 63,
              sessionCount: 2,
              switchOutCount: 2,
              distractingSwitchCount: 1,
              fastSwitchCount: 0,
              returnToCourseCount: 1,
              returnRate: 0.5,
              daily: [
                {
                  date: "2026-03-13",
                  durationMinutes: 63,
                  sessionCount: 2,
                  switchOutCount: 2,
                  distractingSwitchCount: 1,
                },
              ],
              topDistractionHosts: [
                { hostname: "www.youtube.com", durationMinutes: 2 },
              ],
              interruptions: [],
            },
          ],
        }}
        syncStatus={{
          items: [
            {
              id: "run-1",
              status: "completed",
              rowsReceived: 6,
              rowsInserted: 6,
              errorMessage: null,
              createdAt: "2026-03-13T17:24:28.346Z",
              finishedAt: "2026-03-13T17:24:29.346Z",
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText("Focus Flow").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Switch Load").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Time per Tab").length).toBeGreaterThan(0);
    expect(screen.getByText(/Course 101 Modules:35/)).toBeTruthy();
    expect(screen.getByText(/mail.google.com \(masked\):12/)).toBeTruthy();
  });
});
