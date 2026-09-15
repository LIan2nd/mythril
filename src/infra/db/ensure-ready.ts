import { bootstrapDb } from './bootstrap';

let pending: Promise<void> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  const maxAttempts = process.env.VERCEL === '1' ? 1 : 24;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await bootstrapDb();
      console.log('[mythril] database ready (schema + seed applied)');
      return;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) {
        console.error(`[mythril] bootstrap failed after ${maxAttempts} attempt(s): ${reason}`);
        return;
      }
      console.warn(`[mythril] bootstrap attempt ${attempt}/${maxAttempts} failed (${reason}); retrying in 5000ms`);
      await sleep(5_000);
    }
  }
}

export function ensureDbReady(): Promise<void> {
  pending ??= run();
  return pending;
}
