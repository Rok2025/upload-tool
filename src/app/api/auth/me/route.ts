import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// GET /api/auth/me - 获取当前登录用户信息
export async function GET() {
    try {
        const user = await getSession();

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        return NextResponse.json({
            id: user.id,
            username: user.username,
            role: user.role
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
