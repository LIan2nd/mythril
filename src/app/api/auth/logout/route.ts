import type { NextResponse } from 'next/server';
import { ok } from '@/app/lib/http';
import { clearSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<NextResponse> {
  return clearSession(ok(null, 200, 'Signed out'));
}
