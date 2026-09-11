import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse, parseIdParam } from '@/app/lib/http';
import { toggleDoneSchema } from '@/app/lib/validation';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const { done } = parse(toggleDoneSchema, await readBody(req));
    const item = await getServices().checklist.toggleItem(parseIdParam(id), done);
    return ok(item, 200, 'Checklist item updated');
  } catch (err) {
    return fail(err);
  }
}
