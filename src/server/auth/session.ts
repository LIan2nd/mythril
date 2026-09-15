import type { NextResponse } from 'next/server';
import type { AuthUser } from '@/domain/types';
import type { AuthRepo } from '@/domain/repositories';
import { ForbiddenError, UnauthenticatedError } from '@/domain/errors';
import { REMEMBER_MAX_AGE, SESSION_MAX_AGE, signToken, verifyToken, type TokenPayload } from './crypto';

export const SESSION_COOKIE = 'mythril_session';

export interface SessionDeps {
  authRepo: AuthRepo;
}

/** Secure cookies only when we KNOW traffic is https (Vercel) unless explicitly forced. */
function secureCookies(): boolean {
  const flag = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (flag) return flag === '1' || flag === 'true' || flag === 'require';
  return process.env.VERCEL === '1' && process.env.NODE_ENV === 'production';
}

/** Signed session token for cookie auth. */
export function setSession(user: AuthUser, rememberMe = false): string {
  return signToken({ id: user.id, role: user.role }, rememberMe);
}

export function withSession(res: NextResponse, user: AuthUser, rememberMe = false): NextResponse {
  res.cookies.set(SESSION_COOKIE, setSession(user, rememberMe), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: rememberMe ? REMEMBER_MAX_AGE : SESSION_MAX_AGE,
    secure: secureCookies(),
  });
  return res;
}

export function clearSession(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    secure: secureCookies(),
  });
  return res;
}

function readCookieValue(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) {
      const raw = part.slice(eq + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return null;
}

export function readSession(req: Request): TokenPayload | null {
  return verifyToken(readCookieValue(req.headers.get('cookie'), SESSION_COOKIE));
}

/** Loads the CURRENT active user for the request session; instant revocation for disabled/rejected. */
export async function requireUser(req: Request, deps: SessionDeps): Promise<AuthUser> {
  const payload = readSession(req);
  if (!payload) throw new UnauthenticatedError('Invalid or expired session');
  const user = await deps.authRepo.getUserById(payload.uid);
  if (!user) throw new UnauthenticatedError('Invalid or expired session');
  if (user.status !== 'active') throw new UnauthenticatedError('Your session is no longer active');
  return user;
}

export async function requireAdmin(req: Request, deps: SessionDeps): Promise<AuthUser> {
  const user = await requireUser(req, deps);
  if (user.role !== 'admin') throw new ForbiddenError('Admin access required');
  return user;
}
