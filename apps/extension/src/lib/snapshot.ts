import { createFocusSnapshot, focusSnapshotSchema, type FocusSession } from "@quantified-self/focus-core";

export function buildFocusSnapshot(
  sessions: FocusSession[],
  timezone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  exportedAt = new Date().toISOString(),
) {
  return focusSnapshotSchema.parse(
    createFocusSnapshot(sessions, {
      timezone,
      exportedAt,
    }),
  );
}

export function downloadSnapshot(snapshot: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}
