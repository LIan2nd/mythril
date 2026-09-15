import type { NextRequest, NextResponse } from 'next/server';
import { fail, ok, parse, readBody } from '@/app/lib/http';
import { columnCreateSchema } from '@/app/lib/validation';
import { requireAdmin } from '@/server/auth/session';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    return ok(await services.admin.listColumns(decodeURIComponent(key)));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    const body = parse(columnCreateSchema, await readBody(req));
    return ok(await services.admin.createColumn(decodeURIComponent(key), body), 201, 'Column created');
  } catch (err) {
    return fail(err);
  }
}
