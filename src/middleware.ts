import { NextResponse, type NextRequest } from 'next/server';
import { sanitizeNext } from './lib/sanitize-next';

export const SESSION_COOKIE = 'mythril_session';

export function middleware(request: NextRequest) {
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!session) {
    const returnTo = sanitizeNext(request.nextUrl.pathname + request.nextUrl.search);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', returnTo);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/admin/:path*', '/profile/:path*'],
};
