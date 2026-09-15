import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { registerSchema } from '@/app/lib/validation';
import { REGISTER_SUCCESS_MESSAGE } from '@/services';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const input = parse(registerSchema, await readBody(req));
    const user = await getServices().auth.register(input);
    return ok({ user }, 201, REGISTER_SUCCESS_MESSAGE);
  } catch (err) {
    return fail(err);
  }
}
