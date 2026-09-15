import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { adminCreateUserSchema, adminUserListSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    await requireAdmin(req, services.session);
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    const query = parse(adminUserListSchema, { status });
    return ok(await services.admin.listUsers(query.status));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    await requireAdmin(req, services.session);
    const input = parse(adminCreateUserSchema, await readBody(req));
    return ok(await services.admin.createUser(input), 201, 'User created');
  } catch (err) {
    return fail(err);
  }
}
