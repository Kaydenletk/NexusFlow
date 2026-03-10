import { parse } from "csv-parse/sync";

import { AppError } from "./errors.js";

export function parseCsv(buffer: Buffer) {
  const text = buffer.toString("utf8");
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>;

  if (rows.length === 0) {
    throw new AppError(400, "CSV_EMPTY", "CSV file did not contain any rows");
  }

  return rows;
}
