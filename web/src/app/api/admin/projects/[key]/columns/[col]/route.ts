import type { NextRequest, NextResponse } from 'next/server';
import { fail, noContent, ok, parse, readBody } from '@/app/lib/http';
import { columnPatchSchema } from '@/app/lib/validation';
import { requireAdmin } from '@/server/auth/session';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ key: string; col: string }> },
): Promise<NextResponse> {
  try {
    const { key, col } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    const patch = parse(columnPatchSchema, await readBody(req));
    return ok(
      await services.admin.updateColumn(decodeURIComponent(key), decodeURIComponent(col), patch),
      200,
      'Column updated',
    );
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ key: string; col: string }> },
): Promise<NextResponse> {
  try {
    const { key, col } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    await services.admin.deleteColumn(decodeURIComponent(key), decodeURIComponent(col));
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
