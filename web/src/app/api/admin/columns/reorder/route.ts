import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { reorderColumnsSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    await requireAdmin(req, services.session);
    const payload = parse(reorderColumnsSchema, await readBody(req));
    return ok({ columns: await services.admin.reorderColumns(payload) }, 200, 'Columns reordered');
  } catch (err) {
    return fail(err);
  }
}
