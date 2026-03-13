import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasCourseReport } from "./canvas-course-report";
import {
  clearStoredFocusSnapshot,
  saveStoredFocusSnapshot,
} from "../lib/focus-storage";

vi.mock("@tremor/react", () => ({
  AreaChart: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
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
}));

const canvasSnapshot = {
  version: 1,
  exportedAt: "2026-03-13T16:00:00.000Z",
  timezone: "America/New_York",
  sessions: [
    {
      id: "1",
      origin: "https://canvas.instructure.com",
      path: "/courses/101/modules",
      hostname: "canvas.instructure.com",
      category: "learning",
      intent: "productive",
      startTime: "2026-03-12T13:00:00.000Z",
      endTime: "2026-03-12T13:30:00.000Z",
      durationSeconds: 1800,
    },
    {
      id: "2",
      origin: "https://youtube.com",
      path: "/watch",
      hostname: "youtube.com",
      category: "entertainment",
      intent: "distracting",
      startTime: "2026-03-12T13:30:00.000Z",
      endTime: "2026-03-12T13:30:20.000Z",
      durationSeconds: 20,
    },
    {
      id: "3",
      origin: "https://canvas.instructure.com",
      path: "/courses/101/grades",
      hostname: "canvas.instructure.com",
      category: "learning",
      intent: "productive",
      startTime: "2026-03-12T13:30:20.000Z",
      endTime: "2026-03-12T14:00:00.000Z",
      durationSeconds: 1780,
    },
    {
      id: "4",
      origin: "https://canvas.instructure.com",
      path: "/courses/202/modules",
      hostname: "canvas.instructure.com",
      category: "learning",
      intent: "productive",
      startTime: "2026-03-13T13:00:00.000Z",
      endTime: "2026-03-13T14:00:00.000Z",
      durationSeconds: 3600,
    },
  ],
};

describe("CanvasCourseReport", () => {
  afterEach(async () => {
    cleanup();
    await clearStoredFocusSnapshot();
  });

  it("renders an empty state when no snapshot is stored", async () => {
    render(<CanvasCourseReport />);

    expect(await screen.findByText("No snapshot loaded")).toBeTruthy();
  });

  it("renders course metrics from a stored snapshot", async () => {
    await saveStoredFocusSnapshot(canvasSnapshot);

    render(<CanvasCourseReport />);

    const course101Button = await screen.findByRole("button", {
      name: "101",
    });

    expect(screen.getByRole("button", { name: "202" })).toBeTruthy();
    fireEvent.click(course101Button);
    expect(screen.getByText("Top Distraction Hosts")).toBeTruthy();
    expect(screen.getByText(/youtube.com:/)).toBeTruthy();
    expect(screen.getByText("Recent Exits")).toBeTruthy();
  });
});
