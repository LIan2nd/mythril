import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/app/lib/http';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    const user = await requireUser(req, services.session);
    return ok(await services.board.listProjectSummaries(user));
  } catch (err) {
    return fail(err);
  }
}
