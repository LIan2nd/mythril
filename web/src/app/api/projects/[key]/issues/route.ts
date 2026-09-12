import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { createIssueSchema } from '@/app/lib/validation';
import { toIssueDTO } from '@/app/lib/dto';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    const user = await requireUser(req, services.session);
    const payload = parse(createIssueSchema, await readBody(req));
    const issue = await services.issue.createIssue(decodeURIComponent(key), payload, user);
    return ok(toIssueDTO(issue), 201, 'Issue created');
  } catch (err) {
    return fail(err);
  }
}
