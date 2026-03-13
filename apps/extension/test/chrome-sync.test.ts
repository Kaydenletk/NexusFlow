import { describe, expect, it, vi } from "vitest";

import { probeChromeApi, syncChromeSessions } from "../src/lib/chrome-sync.js";
import type { FocusSettings } from "../src/lib/focus-db.js";

function createSettings(): FocusSettings {
  return {
    id: "app",
    notificationsEnabled: true,
    exportVersion: 1,
    timezone: "America/New_York",
    syncEnabled: true,
    apiBaseUrl: "http://localhost:3001",
    lastChromeSyncAt: null,
    lastChromeSyncError: null,
    lastBurnoutLevel: null,
    lastNotificationDate: null,
  };
}

describe("chrome-sync", () => {
  it("falls back from localhost to 127.0.0.1 on health probe", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "ok",
            database: "ok",
            timestamp: "2026-03-13T18:00:00.000Z",
            totalSessions: 10,
            lastSyncAt: null,
            privacyRuleCount: 8,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    const result = await probeChromeApi("http://localhost:3001", fetchImpl);

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "http://localhost:3001/api/chrome/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://127.0.0.1:3001/api/chrome/health",
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.state).toBe("reachable");
    expect(result.baseUrl).toBe("http://127.0.0.1:3001");
  });

  it("does not mark sessions synced when the API is unreachable", async () => {
    const settings = createSettings();
    const saveSettings = vi.fn(async (next: FocusSettings) => next);
    const markSessionsSynced = vi.fn(async () => undefined);
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error("Failed to fetch"));

    await expect(
      syncChromeSessions(
        {
          getSettings: async () => settings,
          saveSettings,
          listUnsyncedSessions: async () => [
            {
              id: "session-1",
              origin: "https://canvas.instructure.com",
              path: "/courses/101/modules",
              hostname: "canvas.instructure.com",
              category: "learning",
              intent: "productive",
              startTime: "2026-03-13T10:00:00.000Z",
              endTime: "2026-03-13T10:20:00.000Z",
              durationSeconds: 1200,
            },
          ],
          markSessionsSynced,
        },
        fetchImpl,
      ),
    ).rejects.toThrow(/Cannot reach local API/);

    expect(markSessionsSynced).not.toHaveBeenCalled();
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        lastChromeSyncError: expect.stringContaining("Cannot reach local API"),
      }),
    );
  });
});
