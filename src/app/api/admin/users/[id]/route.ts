import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, noContent, readBody, parse, parseIdParam } from '@/app/lib/http';
import { adminUpdateUserSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const services = getServices();
    const admin = await requireAdmin(req, services.session);
    const patch = parse(adminUpdateUserSchema, await readBody(req));
    return ok(await services.admin.updateUser(parseIdParam(id), patch, admin.id), 200, 'User updated');
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const services = getServices();
    const admin = await requireAdmin(req, services.session);
    await services.admin.deleteUser(parseIdParam(id), admin.id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
