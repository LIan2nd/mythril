import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse, parseIdParam } from '@/app/lib/http';
import { checklistTextSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await ctx.params;
    const services = getServices();
    const user = await requireUser(req, services.session);
    const { text } = parse(checklistTextSchema, await readBody(req));
    const item = await services.checklist.addItem(parseIdParam(id), text, user);
    return ok(item, 201, 'Checklist item added');
  } catch (err) {
    return fail(err);
  }
}
