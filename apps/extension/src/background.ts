import type { BurnoutAssessment } from "@quantified-self/focus-core";

import {
  getSettings,
  listRecentSessions,
  saveSession,
  saveSettings,
} from "./lib/focus-db.js";
import { FocusSessionRecorder, type TrackableTab } from "./lib/session-recorder.js";

const HEARTBEAT_ALARM = "nexusflow-focus-heartbeat";
let bootstrapped = false;

const recorder = new FocusSessionRecorder(
  {
    getSettings,
    saveSettings,
    saveSession,
    listRecentSessions,
  },
  {
    notify: async (assessment: BurnoutAssessment) => {
      await chrome.notifications.create({
        type: "basic",
        iconUrl: "icon.svg",
        title: "High Cognitive Load Detected",
        message:
          assessment.level === "critical"
            ? "Deep work is dropping while fragmentation keeps rising. Step away from the screen."
            : "Context switching is climbing. Take a short break before momentum slips further.",
      });
    },
  },
);

async function queryActiveTab(windowId?: number) {
  const tabs = await chrome.tabs.query(
    typeof windowId === "number"
      ? { active: true, windowId }
      : { active: true, lastFocusedWindow: true },
  );
  const active = tabs[0];

  if (!active) {
    return null;
  }

  return {
    id: active.id,
    windowId: active.windowId,
    url: active.url ?? active.pendingUrl ?? null,
  } satisfies TrackableTab;
}

async function ensureBackgroundReady() {
  await getSettings();
  await chrome.alarms.create(HEARTBEAT_ALARM, { periodInMinutes: 1 });

  const activeTab = await queryActiveTab();
  await recorder.syncActiveTab(activeTab);
}

function bootstrap() {
  if (bootstrapped) {
    return;
  }

  bootstrapped = true;
  void ensureBackgroundReady();
}

bootstrap();

chrome.runtime.onInstalled.addListener(() => {
  bootstrap();
  void ensureBackgroundReady();
});

chrome.runtime.onStartup.addListener(() => {
  bootstrap();
  void ensureBackgroundReady();
});

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  void chrome.tabs
    .get(tabId)
    .then((tab) =>
      recorder.syncActiveTab({
        id: tab.id,
        windowId: tab.windowId ?? windowId,
        url: tab.url ?? tab.pendingUrl ?? null,
      }),
    );
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.active || (!changeInfo.url && changeInfo.status !== "complete")) {
    return;
  }

  void recorder.syncActiveTab({
    id: tabId,
    windowId: tab.windowId,
    url: changeInfo.url ?? tab.url ?? tab.pendingUrl ?? null,
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void recorder.handleTabRemoved(tabId);
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    void recorder.handleWindowBlur();
    return;
  }

  void queryActiveTab(windowId).then((tab) => recorder.syncActiveTab(tab));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== HEARTBEAT_ALARM) {
    return;
  }

  void recorder.heartbeat(() => queryActiveTab());
});
