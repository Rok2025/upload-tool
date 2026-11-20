import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';
import { syslogInfo, syslogWarn } from '@/lib/syslog';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        const [rows]: any = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            syslogWarn('auth', 'login-failed', `登录失败: ${username}`, { detail: user ? '密码错误' : '用户不存在' });
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        await createSession({
            id: user.id,
            username: user.username,
            role: user.role
        });

        syslogInfo('auth', 'login-success', `用户登录成功: ${user.username}`, { userId: user.id, username: user.username });

        return NextResponse.json({ message: 'Login successful', username: user.username });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
