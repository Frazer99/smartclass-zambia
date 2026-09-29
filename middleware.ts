import { NextRequest, NextResponse } from 'next/server';

/**
 * Optional admin subdomain support. If you configure DNS + a custom
 * domain in Netlify so that `admin.yourdomain.com` also points at this
 * same deployment, this middleware rewrites requests to that subdomain
 * onto the `/admin` routes automatically — so `admin.smartclasszambia.com`
 * serves the admin panel directly at its root, and
 * `admin.smartclasszambia.com/login` serves the admin login page,
 * without a visible `/admin` in the URL.
 *
 * This is entirely inert if you never set up the subdomain: with no DNS
 * record pointing at this deployment for `admin.*`, no request ever
 * arrives with that hostname, so this code never runs. The `/admin` and
 * `/admin/login` paths on the main domain keep working exactly as
 * described in the README either way — the subdomain is an additional,
 * optional entry point, not a replacement for them.
 *
 * Set ADMIN_SUBDOMAIN_HOST as an environment variable (e.g.
 * "admin.smartclasszambia.com") to enable this. Unset, it does nothing.
 */
export function middleware(req: NextRequest) {
  const adminHost = process.env.ADMIN_SUBDOMAIN_HOST;
  if (!adminHost) return NextResponse.next();

  const hostname = req.headers.get('host') || '';
  if (hostname !== adminHost) return NextResponse.next();

  const url = req.nextUrl.clone();
  // "/" on the admin subdomain -> the actual /admin dashboard route.
  // "/login" on the admin subdomain -> /admin/login.
  // Anything already under /admin is left alone (defensive, shouldn't
  // normally be hit since the subdomain is meant to hide that prefix).
  if (!url.pathname.startsWith('/admin')) {
    url.pathname = `/admin${url.pathname === '/' ? '' : url.pathname}`;
  }
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip static assets and Next internals; run on every page request.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
