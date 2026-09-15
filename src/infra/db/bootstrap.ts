import { getDb, type Sql } from './client';
import { ADMIN_PASSWORD_HASH, ADMIN_SEED_USER, buildSeedStatements, SCHEMA_DDL } from './ddl';

export async function isSeeded(sql: Sql = getDb()): Promise<boolean> {
  try {
    const meta = await sql`SELECT value FROM app_metadata WHERE key = 'initial_seed_completed' LIMIT 1`;
    if (meta.length > 0 && meta[0].value === 'true') {
      return true;
    }
    // Fallback: If any users exist, the DB was already seeded prior to app_metadata.
    const users = await sql`SELECT 1 FROM users LIMIT 1`;
    if (users.length > 0) {
      await sql`INSERT INTO app_metadata (key, value) VALUES ('initial_seed_completed', 'true') ON CONFLICT (key) DO NOTHING`;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function markSeeded(sql: Sql = getDb()): Promise<void> {
  await sql`
    INSERT INTO app_metadata (key, value)
    VALUES ('initial_seed_completed', 'true')
    ON CONFLICT (key) DO UPDATE SET value = 'true', updated_at = now()
  `;
}

export async function ensureAdminUser(sql: Sql = getDb()): Promise<void> {
  await sql`
    INSERT INTO users (code, name, avatar_color, username, password_hash, role, status, display_name)
    SELECT ${ADMIN_SEED_USER.code}, ${ADMIN_SEED_USER.displayName}, ${ADMIN_SEED_USER.avatarColor}, ${ADMIN_SEED_USER.username}, ${ADMIN_PASSWORD_HASH}, ${ADMIN_SEED_USER.role}, ${ADMIN_SEED_USER.status}, ${ADMIN_SEED_USER.displayName}
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin' OR username = 'admin')
    ON CONFLICT (code) DO NOTHING
  `;
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

  const alreadySeeded = await isSeeded(sql);
  if (alreadySeeded) {
    await ensureAdminUser(sql);
    return;
  }

  for (const stmt of buildSeedStatements()) {
    await sql.unsafe(stmt.sql, stmt.params);
  }

  await markSeeded(sql);
}
