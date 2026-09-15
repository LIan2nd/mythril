import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { projectMembersSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    const actor = await requireAdmin(req, services.session);
    const { codes } = parse(projectMembersSchema, await readBody(req));
    return ok(await services.admin.setProjectMembers(decodeURIComponent(key), codes, actor), 200, 'Members updated');
  } catch (err) {
    return fail(err);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    await requireAdmin(req, services.session);
    const projects = await services.admin.listProjects();
    const project = projects.find((p) => p.key === decodeURIComponent(key));
    if (!project) return ok(null, 200, 'Project not found');
    return ok(project.members);
  } catch (err) {
    return fail(err);
  }
}
