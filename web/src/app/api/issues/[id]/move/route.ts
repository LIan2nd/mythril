import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse, parseIdParam } from '@/app/lib/http';
import { moveIssueSchema } from '@/app/lib/validation';
import { toIssueDTOs } from '@/app/lib/dto';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const payload = parse(moveIssueSchema, await readBody(req));
    const issues = await getServices().issue.moveIssue(parseIdParam(id), payload);
    return ok({ issues: toIssueDTOs(issues) }, 200, 'Issue moved');
  } catch (err) {
    return fail(err);
  }
}
