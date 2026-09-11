import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse, parseIdParam } from '@/app/lib/http';
import { checklistTextSchema } from '@/app/lib/validation';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const { text } = parse(checklistTextSchema, await readBody(req));
    const item = await getServices().checklist.addItem(parseIdParam(id), text);
    return ok(item, 201, 'Checklist item added');
  } catch (err) {
    return fail(err);
  }
}
