import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { passwordChangeSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    const user = await requireUser(req, services.session);
    const { currentPassword, newPassword } = parse(passwordChangeSchema, await readBody(req));
    await services.profile.changePassword(user, currentPassword, newPassword);
    return ok(null, 200, 'Password updated');
  } catch (err) {
    return fail(err);
  }
}
