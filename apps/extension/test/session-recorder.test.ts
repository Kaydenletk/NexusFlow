import { describe, expect, it, vi } from "vitest";
import { focusSnapshotSchema, type FocusSession } from "@quantified-self/focus-core";

import { buildFocusSnapshot } from "../src/lib/snapshot.js";
import {
  FocusSessionRecorder,
  MIN_SESSION_DURATION_SECONDS,
  type FocusRecorderStore,
} from "../src/lib/session-recorder.js";
import type { FocusSettings } from "../src/lib/focus-db.js";

function createSettings(): FocusSettings {
  return {
    id: "app",
    notificationsEnabled: true,
    exportVersion: 1,
    timezone: "America/New_York",
    lastBurnoutLevel: null,
    lastNotificationDate: null,
  };
}

function createSession(
  id: string,
  category: FocusSession["category"],
  intent: FocusSession["intent"],
  startTime: string,
  endTime: string,
): FocusSession {
  return {
    id,
    origin: "https://github.com",
    path: "/openai/codex",
    hostname: "github.com",
    category,
    intent,
    startTime,
    endTime,
    durationSeconds:
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000,
  };
}

function createStore(existingSessions: FocusSession[] = []) {
  const sessions = [...existingSessions];
  let settings = createSettings();

  const store: FocusRecorderStore = {
    getSettings: vi.fn(async () => settings),
    saveSettings: vi.fn(async (next) => {
      settings = next;
      return settings;
    }),
    saveSession: vi.fn(async (session) => {
      sessions.push(session);
    }),
    listRecentSessions: vi.fn(async () => sessions),
  };

  return {
    store,
    sessions,
    get settings() {
      return settings;
    },
  };
}

describe("FocusSessionRecorder", () => {
  it("finalizes the current session on tab switch", async () => {
    const { store, sessions } = createStore();
    const notify = vi.fn();
    const recorder = new FocusSessionRecorder(store, { notify });

    await recorder.syncActiveTab(
      { id: 1, windowId: 1, url: "https://github.com/openai/codex" },
      new Date("2026-03-10T09:00:00.000Z"),
    );
    await recorder.syncActiveTab(
      { id: 2, windowId: 1, url: "https://www.youtube.com/watch?v=1" },
      new Date("2026-03-10T09:20:00.000Z"),
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0].category).toBe("coding");
    expect(recorder.getActiveSession()?.tabId).toBe(2);
    expect(notify).not.toHaveBeenCalled();
  });

  it("finalizes when the active tab URL changes", async () => {
    const { store, sessions } = createStore();
    const recorder = new FocusSessionRecorder(store, { notify: vi.fn() });

    await recorder.syncActiveTab(
      { id: 1, windowId: 1, url: "https://github.com/openai/codex" },
      new Date("2026-03-10T09:00:00.000Z"),
    );
    await recorder.syncActiveTab(
      { id: 1, windowId: 1, url: "https://www.youtube.com/watch?v=99" },
      new Date("2026-03-10T09:40:00.000Z"),
    );

    expect(sessions).toHaveLength(1);
    expect(sessions[0].durationSeconds).toBe(2400);
    expect(recorder.getActiveSession()?.category).toBe("entertainment");
  });

  it("ignores short sessions and untrackable URLs", async () => {
    const { store, sessions } = createStore();
    const recorder = new FocusSessionRecorder(store, { notify: vi.fn() });

    await recorder.syncActiveTab(
      { id: 1, windowId: 1, url: "chrome://extensions" },
      new Date("2026-03-10T09:00:00.000Z"),
    );
    await recorder.syncActiveTab(
      { id: 2, windowId: 1, url: "https://github.com/openai/codex" },
      new Date("2026-03-10T09:00:02.000Z"),
    );
    await recorder.handleTabRemoved(
      2,
      new Date(
        `2026-03-10T09:00:${String(MIN_SESSION_DURATION_SECONDS - 5).padStart(2, "0")}.000Z`,
      ),
    );

    expect(sessions).toHaveLength(0);
  });

  it("throttles burnout notifications to transitions once per day", async () => {
    const baseSessions = [
      createSession(
        "1",
        "coding",
        "productive",
        "2026-03-01T12:00:00.000Z",
        "2026-03-01T14:00:00.000Z",
      ),
      createSession(
        "2",
        "coding",
        "productive",
        "2026-03-02T12:00:00.000Z",
        "2026-03-02T14:10:00.000Z",
      ),
      createSession(
        "3",
        "coding",
        "productive",
        "2026-03-03T12:00:00.000Z",
        "2026-03-03T14:20:00.000Z",
      ),
      {
        ...createSession(
          "4",
          "entertainment",
          "distracting",
          "2026-03-04T12:00:00.000Z",
          "2026-03-04T17:00:00.000Z",
        ),
        hostname: "youtube.com",
        origin: "https://youtube.com",
        path: "/watch",
      },
      {
        ...createSession(
          "5",
          "entertainment",
          "distracting",
          "2026-03-05T12:00:00.000Z",
          "2026-03-05T17:15:00.000Z",
        ),
        hostname: "youtube.com",
        origin: "https://youtube.com",
        path: "/watch",
      },
      {
        ...createSession(
          "6",
          "entertainment",
          "distracting",
          "2026-03-06T12:00:00.000Z",
          "2026-03-06T17:30:00.000Z",
        ),
        hostname: "youtube.com",
        origin: "https://youtube.com",
        path: "/watch",
      },
    ];
    const { store } = createStore(baseSessions);
    const notify = vi.fn();
    const recorder = new FocusSessionRecorder(store, { notify });

    await recorder.syncActiveTab(
      { id: 1, windowId: 1, url: "https://www.youtube.com/watch?v=1" },
      new Date("2026-03-06T18:00:00.000Z"),
    );
    await recorder.handleWindowBlur(new Date("2026-03-06T18:45:00.000Z"));
    await recorder.syncActiveTab(
      { id: 2, windowId: 1, url: "https://www.youtube.com/watch?v=2" },
      new Date("2026-03-06T19:00:00.000Z"),
    );
    await recorder.handleWindowBlur(new Date("2026-03-06T19:40:00.000Z"));

    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("builds a schema-valid snapshot export", () => {
    const snapshot = buildFocusSnapshot(
      [
        createSession(
          "session-1",
          "coding",
          "productive",
          "2026-03-08T09:00:00.000Z",
          "2026-03-08T09:30:00.000Z",
        ),
      ],
      "America/New_York",
      "2026-03-08T10:00:00.000Z",
    );

    expect(focusSnapshotSchema.parse(snapshot).sessions).toHaveLength(1);
  });
});
