import { NextResponse } from 'next/server';
import { getDb } from '@/infra/db/client';
import { ensureDbReady } from '@/infra/db/ensure-ready';
import { ok } from '@/app/lib/http';
import type { ApiResponse } from '@/domain/types';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await ensureDbReady();
    await getDb()`select 1`;
    return ok({ status: 'ok', db: 'ok' });
  } catch (err) {
    console.error('[health] db unreachable:', err instanceof Error ? err.message : err);
    const body: ApiResponse<null> = { success: false, message: 'Database unavailable', data: null };
    return NextResponse.json(body, { status: 503 });
  }
}
