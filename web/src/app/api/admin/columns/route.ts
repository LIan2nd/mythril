import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { columnCreateSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    await requireAdmin(req, services.session);
    const input = parse(columnCreateSchema, await readBody(req));
    return ok(await services.admin.createColumn(input), 201, 'Column created');
  } catch (err) {
    return fail(err);
  }
}
