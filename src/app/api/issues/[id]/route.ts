import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, noContent, readBody, parse, parseIdParam } from '@/app/lib/http';
import { updateIssueSchema } from '@/app/lib/validation';
import { toIssueDTO } from '@/app/lib/dto';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const services = getServices();
    const user = await requireUser(req, services.session);
    const patch = parse(updateIssueSchema, await readBody(req));
    const issue = await services.issue.updateIssue(parseIdParam(id), patch, user);
    return ok(toIssueDTO(issue), 200, 'Issue updated');
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const services = getServices();
    const user = await requireUser(req, services.session);
    await services.issue.deleteIssue(parseIdParam(id), user);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
