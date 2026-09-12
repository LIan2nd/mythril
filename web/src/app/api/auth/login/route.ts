import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { loginSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { withSession } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const input = parse(loginSchema, await readBody(req));
    const { auth } = getServices();
    const user = await auth.login(input);
    return withSession(ok({ user }, 200, 'Signed in'), user, input.rememberMe ?? false);
  } catch (err) {
    return fail(err);
  }
}
