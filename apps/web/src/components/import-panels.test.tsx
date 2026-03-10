import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportPanel } from "./import-panels";

describe("ImportPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders success feedback after manual submission", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          batch: {
            rowsInserted: 1,
            rowsSkipped: 0,
            rowsReceived: 1,
          },
        }),
      }),
    );

    render(
      <ImportPanel
        datasetPath="coding-activity"
        title="Coding"
        description="Test"
        manualFields={[
          { name: "project", label: "Project", type: "text" },
          { name: "language", label: "Language", type: "text" },
          { name: "durationSeconds", label: "Duration", type: "number" },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: "Dashboard" },
    });
    fireEvent.change(screen.getByLabelText("Language"), {
      target: { value: "TypeScript" },
    });
    fireEvent.change(screen.getByLabelText("Duration"), {
      target: { value: "300" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add manual entry" }));

    await waitFor(() =>
      expect(screen.getByText(/Inserted 1 row/)).toBeTruthy(),
    );
  });
});
