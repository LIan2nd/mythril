const MAX_ATTEMPTS = 24;
const RETRY_DELAY_MS = 5_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  // next build boots instrumentation too; never stall a build waiting on a live database.
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { bootstrapDb } = await import('./infra/db/bootstrap');
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await bootstrapDb();
      console.log('[mythril] database ready (schema + seed applied)');
      return;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_ATTEMPTS) {
        console.error(`[mythril] bootstrap failed after ${MAX_ATTEMPTS} attempts: ${reason}`);
        return;
      }
      console.warn(`[mythril] bootstrap attempt ${attempt}/${MAX_ATTEMPTS} failed (${reason}); retrying in ${RETRY_DELAY_MS}ms`);
      await sleep(RETRY_DELAY_MS);
    }
  }
}
