// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PopupApp } from "./popup";
import {
  exportFocusSnapshot,
  getSettings,
  listUnsyncedSessions,
  listRecentSessions,
  listSessionsForDate,
  markSessionsSynced,
  saveSettings,
} from "../lib/focus-db.js";
import { probeChromeApi, syncChromeSessions } from "../lib/chrome-sync.js";
import { downloadSnapshot } from "../lib/snapshot.js";

vi.mock("../lib/focus-db.js", () => ({
  exportFocusSnapshot: vi.fn(),
  getSettings: vi.fn(),
  listUnsyncedSessions: vi.fn(),
  listRecentSessions: vi.fn(),
  listSessionsForDate: vi.fn(),
  markSessionsSynced: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("../lib/snapshot.js", () => ({
  downloadSnapshot: vi.fn(),
}));

vi.mock("../lib/chrome-sync.js", () => ({
  probeChromeApi: vi.fn(),
  syncChromeSessions: vi.fn(),
}));

const baseSettings = {
  id: "app" as const,
  notificationsEnabled: true,
  exportVersion: 1 as const,
  timezone: "America/New_York",
  syncEnabled: true,
  apiBaseUrl: "http://localhost:3001",
  lastChromeSyncAt: null,
  lastChromeSyncError: null,
  lastBurnoutLevel: null,
  lastNotificationDate: null,
};

const recentSessions = [
  {
    id: "1",
    origin: "https://github.com",
    path: "/openai/codex",
    hostname: "github.com",
    category: "coding" as const,
    intent: "productive" as const,
    startTime: "2026-03-07T14:00:00.000Z",
    endTime: "2026-03-07T15:00:00.000Z",
    durationSeconds: 3600,
  },
  {
    id: "2",
    origin: "https://github.com",
    path: "/openai/codex",
    hostname: "github.com",
    category: "coding" as const,
    intent: "productive" as const,
    startTime: "2026-03-08T14:00:00.000Z",
    endTime: "2026-03-08T15:00:00.000Z",
    durationSeconds: 3600,
  },
  {
    id: "3",
    origin: "https://github.com",
    path: "/openai/codex",
    hostname: "github.com",
    category: "coding" as const,
    intent: "productive" as const,
    startTime: "2026-03-09T14:00:00.000Z",
    endTime: "2026-03-09T15:00:00.000Z",
    durationSeconds: 3600,
  },
  {
    id: "4",
    origin: "https://github.com",
    path: "/openai/codex",
    hostname: "github.com",
    category: "coding" as const,
    intent: "productive" as const,
    startTime: "2026-03-10T14:00:00.000Z",
    endTime: "2026-03-10T15:00:00.000Z",
    durationSeconds: 3600,
  },
  {
    id: "5",
    origin: "https://github.com",
    path: "/openai/codex",
    hostname: "github.com",
    category: "coding" as const,
    intent: "productive" as const,
    startTime: "2026-03-11T14:00:00.000Z",
    endTime: "2026-03-11T15:00:00.000Z",
    durationSeconds: 3600,
  },
  {
    id: "6",
    origin: "https://github.com",
    path: "/openai/codex",
    hostname: "github.com",
    category: "coding" as const,
    intent: "productive" as const,
    startTime: "2026-03-12T14:00:00.000Z",
    endTime: "2026-03-12T15:00:00.000Z",
    durationSeconds: 3600,
  },
];

function createBurstSessions(dayIsoDate: string) {
  const start = new Date(`${dayIsoDate}T09:00:00.000Z`).getTime();

  return Array.from({ length: 22 }, (_, index) => {
    const sessionStart = new Date(start + index * 30_000).toISOString();
    const sessionEnd = new Date(start + (index + 1) * 30_000).toISOString();

    return {
      id: `burst-${index + 1}`,
      origin: `https://burst-${index}.example.com`,
      path: `/task/${index}`,
      hostname: `burst-${index}.example.com`,
      category: "coding" as const,
      intent: "productive" as const,
      startTime: sessionStart,
      endTime: sessionEnd,
      durationSeconds: 30,
    };
  });
}

describe("PopupApp", () => {
  beforeEach(() => {
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const todaySession = {
      ...recentSessions[5],
      startTime: `${todayIsoDate}T14:00:00.000Z`,
      endTime: `${todayIsoDate}T15:00:00.000Z`,
    };
    const rollingSessions = [...recentSessions.slice(0, 5), todaySession];

    vi.mocked(getSettings).mockResolvedValue(baseSettings);
    vi.mocked(listUnsyncedSessions).mockResolvedValue([]);
    vi.mocked(listSessionsForDate).mockResolvedValue([todaySession]);
    vi.mocked(listRecentSessions).mockResolvedValue(rollingSessions);
    vi.mocked(exportFocusSnapshot).mockResolvedValue({
      version: 1,
      exportedAt: new Date().toISOString(),
      timezone: "America/New_York",
      sessions: rollingSessions,
    });
    vi.mocked(saveSettings).mockImplementation(async (next) => next);
    vi.mocked(probeChromeApi).mockResolvedValue({
      state: "reachable",
      baseUrl: "http://localhost:3001",
      health: {
        status: "ok",
        database: "ok",
        timestamp: "2026-03-13T10:00:00.000Z",
        totalSessions: 6,
        lastSyncAt: null,
        privacyRuleCount: 8,
      },
      message: "Connected to http://localhost:3001.",
    });
    vi.mocked(syncChromeSessions).mockResolvedValue({
      run: {
        id: "sync-1",
        status: "completed",
        rowsReceived: 0,
        rowsInserted: 0,
        startedAt: "2026-03-13T10:00:00.000Z",
        finishedAt: "2026-03-13T10:00:01.000Z",
        createdAt: "2026-03-13T10:00:00.000Z",
      },
      receivedCount: 0,
      insertedCount: 0,
      connection: {
        state: "reachable",
        baseUrl: "http://localhost:3001",
        health: {
          status: "ok",
          database: "ok",
          timestamp: "2026-03-13T10:00:00.000Z",
          totalSessions: 6,
          lastSyncAt: null,
          privacyRuleCount: 8,
        },
        message: "Connected to http://localhost:3001.",
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads today's metrics from Dexie-backed helpers", async () => {
    render(<PopupApp />);

    expect(await screen.findByText("Time Today")).toBeInTheDocument();
    expect(screen.getByText("Deep Work")).toBeInTheDocument();
    expect(screen.getByText("Burnout Level")).toBeInTheDocument();
    expect(screen.getAllByText("Safe").length).toBeGreaterThan(0);
    expect(screen.getByText("Export Snapshot")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Burnout notifications" })).toBeInTheDocument();
  });

  it("exports a snapshot and updates the notification setting", async () => {
    render(<PopupApp />);

    await screen.findByText("Time Today");

    fireEvent.click(screen.getByRole("switch", { name: "Burnout notifications" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        ...baseSettings,
        notificationsEnabled: false,
      }),
    );

    fireEvent.click(screen.getByText("Export Snapshot"));

    await waitFor(() =>
      expect(downloadSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 1,
          sessions: expect.arrayContaining([expect.objectContaining({ id: "6" })]),
        }),
        expect.stringMatching(/^nexusflow-export-\d{4}-\d{2}-\d{2}\.json$/),
      ),
    );
  });

  it("saves localhost sync settings and triggers manual sync", async () => {
    vi.mocked(listUnsyncedSessions).mockResolvedValue([
      {
        id: "pending-1",
        origin: "https://canvas.instructure.com",
        path: "/courses/101/modules",
        hostname: "canvas.instructure.com",
        category: "learning",
        intent: "productive",
        startTime: "2026-03-13T10:00:00.000Z",
        endTime: "2026-03-13T10:30:00.000Z",
        durationSeconds: 1800,
      },
    ]);

    render(<PopupApp />);
    await screen.findByText("Time Today");

    // Expand sync section
    fireEvent.click(screen.getByText("Sync"));

    await waitFor(() =>
      expect(screen.getByPlaceholderText("http://localhost:3001")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByPlaceholderText("http://localhost:3001"), {
      target: { value: "http://localhost:4010" },
    });
    vi.mocked(probeChromeApi).mockResolvedValueOnce({
      state: "reachable",
      baseUrl: "http://127.0.0.1:4010",
      health: {
        status: "ok",
        database: "ok",
        timestamp: "2026-03-13T10:00:00.000Z",
        totalSessions: 6,
        lastSyncAt: null,
        privacyRuleCount: 8,
      },
      message: "Connected to http://127.0.0.1:4010.",
    });

    fireEvent.click(screen.getByRole("button", { name: /Test Connection/i }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith({
        ...baseSettings,
        apiBaseUrl: "http://127.0.0.1:4010",
        lastChromeSyncError: null,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /Sync Now/i }));

    await waitFor(() => expect(syncChromeSessions).toHaveBeenCalled());
    expect((await screen.findAllByText(/No unsynced sessions|Synced/i)).length).toBeGreaterThan(0);
  });

  it("shows actionable connection errors instead of generic fetch failures", async () => {
    vi.mocked(probeChromeApi).mockResolvedValueOnce({
      state: "unreachable",
      baseUrl: "http://localhost:3001",
      health: null,
      message: "Cannot reach local API.",
    });

    render(<PopupApp />);

    expect(await screen.findByText("Offline")).toBeInTheDocument();
  });

  it("shows warming up state for very low active time", async () => {
    const todayIsoDate = new Date().toISOString().slice(0, 10);
    const shortSession = {
      ...recentSessions[5],
      startTime: `${todayIsoDate}T08:00:00.000Z`,
      endTime: `${todayIsoDate}T08:05:00.000Z`,
      durationSeconds: 300,
    };

    vi.mocked(listSessionsForDate).mockResolvedValue([shortSession]);
    vi.mocked(listRecentSessions).mockResolvedValue(createBurstSessions(todayIsoDate));

    render(<PopupApp />);

    expect((await screen.findAllByText("Warming up")).length).toBeGreaterThan(0);
  });
});
