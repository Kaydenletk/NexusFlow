import { closePool, getPool } from "./client.js";

async function run() {
  const pool = getPool();
  const { rows } = await pool.query<{
    version: string;
    now: string;
  }>("SELECT version() AS version, NOW()::text AS now");

  console.log(rows[0]);
  await closePool();
}

run().catch(async (error) => {
  console.error(error);
  await closePool();
  process.exit(1);
});
