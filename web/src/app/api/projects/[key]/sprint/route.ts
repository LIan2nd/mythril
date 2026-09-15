import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/app/lib/http';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';
import type { UpsertSprintInput } from '@/domain/repositories';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    const user = await requireUser(req, services.session);
    const body = (await req.json()) as UpsertSprintInput;
    const sprint = await services.board.updateSprint(decodeURIComponent(key), body, user);
    return ok(sprint, 200, 'Sprint updated');
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  return PUT(req, ctx);
}
