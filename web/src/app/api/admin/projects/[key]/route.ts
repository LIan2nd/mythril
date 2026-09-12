import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, noContent, readBody, parse } from '@/app/lib/http';
import { adminUpdateProjectSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    const patch = parse(adminUpdateProjectSchema, await readBody(req));
    return ok(await services.admin.renameProject(decodeURIComponent(key), patch), 200, 'Project updated');
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    await services.admin.deleteProject(decodeURIComponent(key));
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
