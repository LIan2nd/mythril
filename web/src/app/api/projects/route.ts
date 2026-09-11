import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/app/lib/http';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    return ok(await getServices().board.listProjectSummaries());
  } catch (err) {
    return fail(err);
  }
}
