import { config } from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

config({ path: "../../.env" });
config();

let pool: Pool | undefined;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/quantified_self",
    });
  }

  return pool;
}

export function getDb() {
  return drizzle(getPool());
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
