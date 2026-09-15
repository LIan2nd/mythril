import type { NextRequest, NextResponse } from 'next/server';
import { fail, ok, parse, readBody } from '@/app/lib/http';
import { reorderColumnsSchema } from '@/app/lib/validation';
import { requireAdmin } from '@/server/auth/session';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    const body = parse(reorderColumnsSchema, await readBody(req));
    return ok(await services.admin.reorderColumns(decodeURIComponent(key), body), 200, 'Columns reordered');
  } catch (err) {
    return fail(err);
  }
}
