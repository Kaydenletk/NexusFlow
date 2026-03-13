import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "NexusFlow Focus",
  version: "0.1.0",
  description:
    "Privacy-first focus tracking for Chrome context switching, deep work, and burnout heuristics.",
  icons: {
    128: "icon.svg",
  },
  action: {
    default_title: "NexusFlow Focus",
    default_popup: "popup.html",
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
