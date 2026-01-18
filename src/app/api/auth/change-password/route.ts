import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const user = await getSession();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { oldPassword, newPassword } = body;

        if (!oldPassword || !newPassword) {
            return NextResponse.json(
                { error: 'Old password and new password are required' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { error: 'New password must be at least 6 characters long' },
                { status: 400 }
            );
        }

        // Get current user's password hash
        const [rows]: any = await pool.query(
            'SELECT password_hash FROM users WHERE id = ?',
            [user.id]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const currentHash = rows[0].password_hash;

        // Verify old password
        const isMatch = await bcrypt.compare(oldPassword, currentHash);

        if (!isMatch) {
            return NextResponse.json(
                { error: 'Incorrect old password' },
                { status: 400 }
            );
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(newPassword, salt);

        // Update password
        await pool.query(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newHash, user.id]
        );

        return NextResponse.json({ message: 'Password updated successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
