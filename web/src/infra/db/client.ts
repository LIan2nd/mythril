import postgres from 'postgres';

export type Sql = postgres.Sql;

const FALLBACK_URL = 'postgresql://mythril:mythril@localhost:5433/mythril';

let pool: Sql | null = null;

function resolveUrl(): string {
  return process.env.DATABASE_URL?.trim() || FALLBACK_URL;
}

function resolveSsl(url: string): { require: boolean } | undefined {
  if (/[?&]sslmode=require/.test(url)) return { require: true };
  if (/[?&]sslmode=/.test(url)) return undefined;
  const flag = process.env.DB_SSL?.trim().toLowerCase();
  return flag === 'require' || flag === 'true' ? { require: true } : undefined;
}

export function getDb(): Sql {
  if (!pool) {
    const url = resolveUrl();
    const ssl = resolveSsl(url);
    pool = postgres(url, { max: 10, ...(ssl ? { ssl } : {}), onnotice: () => {} });
  }
  return pool;
}
