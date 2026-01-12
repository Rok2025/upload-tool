import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const { username, password } = await req.json();

        const [rows]: any = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        const user = rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        await createSession({
            id: user.id,
            username: user.username,
            role: user.role
        });

        return NextResponse.json({ message: 'Login successful', username: user.username });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
