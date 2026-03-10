import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { closePool, getPool } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const pool = getPool();
  const migrationsDir = path.resolve(__dirname, "../migrations");
  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      name TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query<{ name: string }>(
    "SELECT name FROM app_migrations",
  );
  const executed = new Set(rows.map((row: { name: string }) => row.name));

  for (const fileName of files) {
    if (executed.has(fileName)) {
      continue;
    }

    const fullPath = path.join(migrationsDir, fileName);
    const sqlText = await readFile(fullPath, "utf8");

    await pool.query("BEGIN");
    try {
      await pool.query(sqlText);
      await pool.query("INSERT INTO app_migrations (name) VALUES ($1)", [
        fileName,
      ]);
      await pool.query("COMMIT");
      console.log(`Applied migration ${fileName}`);
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }

  await closePool();
}

run().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
