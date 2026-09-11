import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { createIssueSchema } from '@/app/lib/validation';
import { toIssueDTO } from '@/app/lib/dto';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const payload = parse(createIssueSchema, await readBody(req));
    const issue = await getServices().issue.createIssue(decodeURIComponent(key), payload);
    return ok(toIssueDTO(issue), 201, 'Issue created');
  } catch (err) {
    return fail(err);
  }
}
