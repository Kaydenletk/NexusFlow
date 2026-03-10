import { describe, expect, it } from "vitest";

import { parseCsv } from "../src/lib/csv.js";

describe("parseCsv", () => {
  it("parses csv rows with headers", () => {
    const rows = parseCsv(
      Buffer.from("time,project,language,duration_seconds\n2026-03-10T08:00:00Z,QS,TypeScript,300\n"),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.project).toBe("QS");
  });
});
