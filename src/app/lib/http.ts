import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AppError, ValidationError } from '@/domain/errors';
import type { ApiResponse } from '@/domain/types';

export function ok<T>(data: T, status = 200, message = 'OK'): NextResponse {
  const body: ApiResponse<T> = { success: true, message, data };
  return NextResponse.json(body, { status });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export function fail(err: unknown): NextResponse {
  if (err instanceof AppError) {
    const body: ApiResponse<null> = { success: false, message: err.message, data: null };
    return NextResponse.json(body, { status: err.statusCode });
  }
  console.error('[api]', err);
  const body: ApiResponse<null> = { success: false, message: 'Internal', data: null };
  return NextResponse.json(body, { status: 400 });
}

export async function readBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first && first.path.length > 0 ? `${String(first.path[0])}: ` : '';
    throw new ValidationError(`${path}${first?.message ?? 'Invalid input'}`);
  }
  return result.data;
}

export function parseIdParam(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) throw new ValidationError(`Invalid id ${raw}`);
  return id;
}
