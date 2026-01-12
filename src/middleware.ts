import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const session = request.cookies.get('session')?.value;
    const { pathname } = request.nextUrl;

    // 1. If user is trying to access dashboard/deploy/logs/config without session, redirect to login
    const isProtectedRoute = pathname === '/' || pathname.startsWith('/deploy') || pathname.startsWith('/logs') || pathname.startsWith('/config');

    if (isProtectedRoute && !session) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. If user is already logged in and tries to access login page, redirect to home
    if (pathname === '/login' && session) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
