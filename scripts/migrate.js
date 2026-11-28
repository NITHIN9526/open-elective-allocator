require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { getPool, closePool } = require("../src/database");

async function main() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    const migrations = [
      { version: "001_initial_schema", file: "001_initial_schema.sql" },
      { version: "002_reference_data", file: "002_reference_data.sql" }
    ];
    for (const migration of migrations) {
      const exists = await client.query(
        "SELECT 1 FROM schema_migrations WHERE version = $1",
        [migration.version]
      );
      if (exists.rowCount) {
        console.log("Already applied:", migration.version);
        continue;
      }
      const sql = fs.readFileSync(path.join(__dirname, "..", "db", "migrations", migration.file), "utf8");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(version) VALUES ($1)", [migration.version]);
      console.log("Applied:", migration.version);
    }
    await client.query("COMMIT");
    console.log("Database migrations completed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closePool();
  }
}
main().catch(error => {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
});
