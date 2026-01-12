import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth';

export async function POST() {
    try {
        await destroySession();
        return NextResponse.json({ message: 'Logout successful' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
