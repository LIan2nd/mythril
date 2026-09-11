import postgres from 'postgres';

export type Sql = postgres.Sql;

const FALLBACK_URL = 'postgresql://mythril:***@localhost:5432/mythril';

let pool: Sql | null = null;

function resolveUrl(): string {
  return process.env.DB_URL?.trim() || process.env.DATABASE_URL?.trim() || FALLBACK_URL;
}

function parseSslMode(value: string | undefined): { require: boolean; rejectUnauthorized?: boolean } | undefined {
  if (!value) return undefined;
  if (value === 'require' || value === 'true') return { require: true };
  if (value === 'no-verify') return { require: true, rejectUnauthorized: false };
  return undefined;
}

function resolveSsl(url: string): { require: boolean; rejectUnauthorized?: boolean } | undefined {
  const fromUrl = parseSslMode(url.match(/[?&]sslmode=([^&]+)/)?.[1]);
  if (fromUrl) return fromUrl;
  return parseSslMode(process.env.DB_SSL?.trim().toLowerCase()) ?? undefined;
}

/** Supabase transaction pooler (PgBouncer) rejects extended prepared statements. */
function usesTransactionPooler(url: string): boolean {
  return /[?&]pgbouncer=true/.test(url) || /:6543(\/|$|\?)/.test(url);
}

export function getDb(): Sql {
  if (!pool) {
    const url = resolveUrl();
    const ssl = resolveSsl(url);
    pool = postgres(url, {
      max: 10,
      ...(ssl ? { ssl } : {}),
      ...(usesTransactionPooler(url) ? { prepare: false } : {}),
      onnotice: () => {},
    });
  }
  return pool;
}
