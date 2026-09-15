import type { NextRequest, NextResponse } from 'next/server';
import { ok, fail, readBody, parse } from '@/app/lib/http';
import { adminCreateProjectSchema } from '@/app/lib/validation';
import { getServices } from '@/services';
import { requireAdmin } from '@/server/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    await requireAdmin(req, services.session);
    return ok(await services.admin.listProjects());
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const services = getServices();
    await requireAdmin(req, services.session);
    const input = parse(adminCreateProjectSchema, await readBody(req));
    return ok(await services.admin.createProject(input), 201, 'Project created');
  } catch (err) {
    return fail(err);
  }
}
