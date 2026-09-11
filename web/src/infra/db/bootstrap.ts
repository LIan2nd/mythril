import { getDb, type Sql } from './client';
import { buildSeedStatements, SCHEMA_DDL } from './ddl';

export async function isSeeded(sql: Sql = getDb()): Promise<boolean> {
  try {
    const rows = await sql`select 1 from issues limit 1`;
    return rows.length > 0;
  } catch {
    return false;
  }
}

let inflight: Promise<void> | null = null;

export function bootstrapDb(): Promise<void> {
  inflight ??= runBootstrap().catch((err) => {
    inflight = null;
    throw err;
  });
  return inflight;
}

async function runBootstrap(): Promise<void> {
  const sql = getDb();
  await sql.unsafe(SCHEMA_DDL);
  for (const stmt of buildSeedStatements()) {
    await sql.unsafe(stmt.sql, stmt.params);
  }
}
