import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/app/lib/http';
import { toIssueDTOs } from '@/app/lib/dto';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const services = getServices();
    const user = await requireUser(req, services.session);
    const board = await services.board.getBoard(decodeURIComponent(key), user);
    return ok({ ...board, issues: toIssueDTOs(board.issues) });
  } catch (err) {
    return fail(err);
  }
}
