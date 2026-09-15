import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { Role } from '@/domain/types';

export const SESSION_MAX_AGE = 7 * 24 * 3600;
export const REMEMBER_MAX_AGE = 30 * 24 * 3600;

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 32, saltLen: 16, maxMem: 64 * 1024 * 1024 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(SCRYPT.saltLen);
  const digest = scryptSync(password, salt, SCRYPT.keyLen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxMem,
  });
  return ['scrypt', String(SCRYPT.N), salt.toString('hex'), digest.toString('hex')].join('$');
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false;
  const n = Number(parts[1]);
  if (!Number.isInteger(n) || n < 2 || (n & (n - 1)) !== 0 || n > 1 << 16) return false;
  const salt = Buffer.from(parts[2], 'hex');
  const expected = Buffer.from(parts[3], 'hex');
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = scryptSync(password, salt, expected.length, {
    N: n,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxMem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface TokenPayload {
  uid: number;
  role: Role;
  exp: number;
}

export interface TokenSubject {
  id: number;
  role: Role;
}

const DEV_SECRET_FALLBACK = 'mythril-dev-secret';
let warnedAboutFallback = false;

function signingKey(): Buffer {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return Buffer.from(configured);
  if (!warnedAboutFallback) {
    warnedAboutFallback = true;
    console.warn('[mythril] SESSION_SECRET is not set — using the insecure dev fallback signing key');
  }
  return Buffer.from(DEV_SECRET_FALLBACK);
}

function hmac(payload: string): string {
  return createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

export function signToken(user: TokenSubject, rememberMe = false): string {
  const maxAge = rememberMe ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  const payload: TokenPayload = { uid: user.id, role: user.role, exp: Date.now() + maxAge * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${hmac(encoded)}`;
}

export function verifyToken(token: string | null | undefined): TokenPayload | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const encoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const expected = Buffer.from(hmac(encoded));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    if (!payload || typeof payload.uid !== 'number' || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function pickColor(seed: string): string {
  const palette = ['yellow', 'coral', 'mint', 'sky', 'lav'];
  const index = createHash('sha256').update(seed).digest()[0] % palette.length;
  return palette[index];
}
