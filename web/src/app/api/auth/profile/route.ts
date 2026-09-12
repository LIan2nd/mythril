import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { profilePatchSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    const user = await requireUser(req, services.session);
    const patch = parse(profilePatchSchema, await readBody(req));
    return ok({ user: await services.profile.updateProfile(user, patch) }, 200, 'Profile updated');
  } catch (err) {
    return fail(err);
  }
}
