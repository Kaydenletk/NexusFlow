import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "NexusFlow",
  version: "0.1.0",
  description:
    "Privacy-first focus tracking for Chrome context switching, deep work, and burnout heuristics.",
  icons: {
    16: "icons/icon-16.png",
    32: "icons/icon-32.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
  action: {
    default_title: "NexusFlow",
    default_popup: "popup.html",
    default_icon: {
      16: "icons/icon-16.png",
      32: "icons/icon-32.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
  permissions: [
    "tabs",
    "storage",
    "unlimitedStorage",
    "alarms",
    "notifications",
  ],
  host_permissions: ["<all_urls>"],
});
