import postgres from 'postgres';

export type Sql = postgres.Sql;

const FALLBACK_URL = 'postgresql://mythril:***@localhost:5432/mythril';

let pool: Sql | null = null;

function resolveUrl(): string {
  return process.env.DB_URL?.trim() || process.env.DATABASE_URL?.trim() || FALLBACK_URL;
}

function parseSslMode(value: string | undefined): 'require' | 'allow' | 'prefer' | { rejectUnauthorized: boolean } | boolean | undefined {
  if (!value) return undefined;
  const v = value.toLowerCase();
  if (v === 'require' || v === 'true' || v === 'no-verify') return 'require';
  if (v === 'verify-full') return { rejectUnauthorized: true };
  if (v === 'prefer' || v === 'allow') return v;
  if (v === 'disable' || v === 'false') return false;
  return undefined;
}

function resolveSsl(url: string): 'require' | 'allow' | 'prefer' | { rejectUnauthorized: boolean } | boolean | undefined {
  const fromUrl = parseSslMode(url.match(/[?&]sslmode=([^&]+)/)?.[1]);
  if (fromUrl !== undefined) return fromUrl;
  return parseSslMode(process.env.DB_SSL?.trim());
}

/** Supabase transaction pooler (PgBouncer) rejects extended prepared statements. */
function usesTransactionPooler(url: string): boolean {
  return /[?&]pgbouncer=true/.test(url) || /:6543(\/|$|\?)/.test(url);
}

const globalForDb = globalThis as unknown as {
  postgresPool: Sql | undefined;
};

export function getDb(): Sql {
  if (!globalForDb.postgresPool) {
    const url = resolveUrl();
    const ssl = resolveSsl(url);
    globalForDb.postgresPool = postgres(url, {
      max: 10,
      ...(ssl !== undefined ? { ssl } : {}),
      ...(usesTransactionPooler(url) ? { prepare: false } : {}),
      onnotice: () => {},
    });
  }
  return globalForDb.postgresPool;
}
