import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FocusDashboard } from "./focus-dashboard";
import { clearStoredFocusSnapshot } from "../lib/focus-storage";

vi.mock("@tremor/react", () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
  LineChart: ({ data }: { data: unknown }) => <pre>{JSON.stringify(data)}</pre>,
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

const validSnapshot = {
  version: 1,
  exportedAt: "2026-03-08T10:00:00.000Z",
  timezone: "America/New_York",
  sessions: [
    {
      id: "1",
      origin: "https://github.com",
      path: "/openai/codex",
      hostname: "github.com",
      category: "coding",
      intent: "productive",
      startTime: "2026-03-07T13:00:00.000Z",
      endTime: "2026-03-07T13:35:00.000Z",
      durationSeconds: 2100,
    },
    {
      id: "2",
      origin: "https://youtube.com",
      path: "/watch",
      hostname: "youtube.com",
      category: "entertainment",
      intent: "distracting",
      startTime: "2026-03-07T14:00:00.000Z",
      endTime: "2026-03-07T14:30:00.000Z",
      durationSeconds: 1800,
    },
    {
      id: "3",
      origin: "https://github.com",
      path: "/openai/codex/pulls",
      hostname: "github.com",
      category: "coding",
      intent: "productive",
      startTime: "2026-03-08T13:00:00.000Z",
      endTime: "2026-03-08T13:45:00.000Z",
      durationSeconds: 2700,
    },
  ],
};

describe("FocusDashboard", () => {
  afterEach(async () => {
    cleanup();
    await clearStoredFocusSnapshot();
  });

  it("renders the empty state before import", async () => {
    render(<FocusDashboard />);

    expect(await screen.findByText("No focus snapshot yet")).toBeTruthy();
  });

  it("imports a valid snapshot and renders summaries", async () => {
    render(<FocusDashboard />);

    const input = await screen.findByLabelText("Upload snapshot");
    const file = new File([JSON.stringify(validSnapshot)], "focus.json", {
      type: "application/json",
    });

    fireEvent.change(input, {
      target: { files: [file] },
    });

    expect(await screen.findByText("Snapshot imported.")).toBeTruthy();
    expect(await screen.findByText("Latest deep work")).toBeTruthy();
    expect(screen.getByText("Top domains")).toBeTruthy();
    expect(screen.getByText(/github.com:/)).toBeTruthy();
  });

  it("rejects invalid snapshot files", async () => {
    render(<FocusDashboard />);

    const input = await screen.findByLabelText("Upload snapshot");
    const file = new File([JSON.stringify({ version: 9 })], "invalid.json", {
      type: "application/json",
    });

    fireEvent.change(input, {
      target: { files: [file] },
    });

    expect(
      await screen.findByText(/Invalid input|Expected literal value/),
    ).toBeTruthy();
  });

  it("persists imported snapshots across remounts", async () => {
    const firstRender = render(<FocusDashboard />);
    const input = await screen.findByLabelText("Upload snapshot");
    const file = new File([JSON.stringify(validSnapshot)], "focus.json", {
      type: "application/json",
    });

    fireEvent.change(input, {
      target: { files: [file] },
    });

    expect(await screen.findByText("Snapshot imported.")).toBeTruthy();
    firstRender.unmount();

    render(<FocusDashboard />);

    expect(await screen.findByText("Latest active time")).toBeTruthy();
    expect(screen.getByText("Clear stored snapshot")).toBeTruthy();
  });
});
