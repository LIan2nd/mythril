import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/app/lib/http';
import { toIssueDTOs } from '@/app/lib/dto';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }): Promise<NextResponse> {
  try {
    const { key } = await ctx.params;
    const board = await getServices().board.getBoard(decodeURIComponent(key));
    return ok({ ...board, issues: toIssueDTOs(board.issues) });
  } catch (err) {
    return fail(err);
  }
}
