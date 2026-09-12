import { NextResponse } from 'next/server';
import { getServices } from '@/services';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }): Promise<NextResponse> {
  try {
    const { code } = await ctx.params;
    const avatar = await getServices().profile.getAvatar(decodeURIComponent(code));
    return new NextResponse(avatar.data as unknown as BodyInit, {
      headers: { 'content-type': avatar.type, 'cache-control': 'no-store' },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
