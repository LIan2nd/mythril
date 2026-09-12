import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail } from '@/app/lib/http';
import { ValidationError } from '@/domain/errors';
import { getServices } from '@/services';
import { requireUser } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    const user = await requireUser(req, services.session);
    const file = (await req.formData()).get('file');
    if (!(file instanceof File)) throw new ValidationError('Attach the image under the "file" field');
    const bytes = new Uint8Array(await file.arrayBuffer());
    return ok({ user: await services.profile.uploadAvatar(user, bytes) }, 200, 'Avatar updated');
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    const user = await requireUser(req, services.session);
    return ok({ user: await services.profile.removeAvatar(user) }, 200, 'Avatar removed');
  } catch (err) {
    return fail(err);
  }
}
