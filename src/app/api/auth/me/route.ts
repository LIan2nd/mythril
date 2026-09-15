import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/app/lib/http';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { session } = getServices();
    return ok({ user: await requireUser(req, session) });
  } catch (err) {
    return fail(err);
  }
}
