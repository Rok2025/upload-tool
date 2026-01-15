import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-123';

export interface UserSession {
    id: number;
    username: string;
    role: string;
}

export async function createSession(user: UserSession) {
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '8h' });
    const cookieStore = await cookies();
    cookieStore.set('session', token, {
        httpOnly: true,
        secure: false, // Changed to false to allow login over HTTP (IP address)
        sameSite: 'lax',
        maxAge: 60 * 60 * 8, // 8 hours
        path: '/',
    });
}

export async function getSession(): Promise<UserSession | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get('session')?.value;
    if (!token) return null;

    try {
        return jwt.verify(token, JWT_SECRET) as UserSession;
    } catch {
        return null;
    }
}

export async function destroySession() {
    const cookieStore = await cookies();
    cookieStore.delete('session');
}
