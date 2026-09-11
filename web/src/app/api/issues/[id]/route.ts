import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, noContent, readBody, parse, parseIdParam } from '@/app/lib/http';
import { updateIssueSchema } from '@/app/lib/validation';
import { toIssueDTO } from '@/app/lib/dto';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const patch = parse(updateIssueSchema, await readBody(req));
    const issue = await getServices().issue.updateIssue(parseIdParam(id), patch);
    return ok(toIssueDTO(issue), 200, 'Issue updated');
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    await getServices().issue.deleteIssue(parseIdParam(id));
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
