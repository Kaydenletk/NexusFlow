"use client";

import Dexie, { type Table } from "dexie";
import {
  focusSnapshotSchema,
  type FocusSnapshotV1,
} from "@nexusflow/focus-core";

type StoredFocusSnapshot = {
  id: "latest";
  snapshot: FocusSnapshotV1;
  importedAt: string;
};

class FocusDashboardDatabase extends Dexie {
  snapshots!: Table<StoredFocusSnapshot, string>;

  constructor() {
    super("nexusflow-focus-dashboard");

    this.version(1).stores({
      snapshots: "id,importedAt",
    });
  }
}

const dashboardDb = new FocusDashboardDatabase();

export async function loadStoredFocusSnapshot() {
  const row = await dashboardDb.snapshots.get("latest");

  return row?.snapshot ?? null;
}

export async function saveStoredFocusSnapshot(snapshot: unknown) {
  const parsed = focusSnapshotSchema.parse(snapshot);

  await dashboardDb.snapshots.put({
    id: "latest",
    snapshot: parsed,
    importedAt: new Date().toISOString(),
  });

  return parsed;
}

export async function clearStoredFocusSnapshot() {
  await dashboardDb.snapshots.delete("latest");
}
