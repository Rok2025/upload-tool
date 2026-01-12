import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';

// GET /api/users - 获取所有用户
export async function GET() {
    try {
        const user = await getSession();

        // 只有 admin 可以查看用户列表
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const [rows]: any = await pool.query(`
            SELECT id, username, email, role, status, created_at, updated_at
            FROM users
            ORDER BY created_at DESC
        `);

        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/users - 创建新用户
export async function POST(req: NextRequest) {
    try {
        const user = await getSession();

        // 只有 admin 可以创建用户
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { username, email, password, role = 'developer' } = body;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Username and password are required' },
                { status: 400 }
            );
        }

        // 检查用户名是否已存在
        const [existing]: any = await pool.query(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );

        if (existing.length > 0) {
            return NextResponse.json(
                { error: 'Username already exists' },
                { status: 400 }
            );
        }

        // 如果提供了 email，检查是否已存在
        if (email) {
            const [emailExists]: any = await pool.query(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );
            if (emailExists.length > 0) {
                return NextResponse.json(
                    { error: 'Email already exists' },
                    { status: 400 }
                );
            }
        }

        // 加密密码
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 插入新用户
        const [result]: any = await pool.query(
            `INSERT INTO users (username, email, password_hash, role, status) 
             VALUES (?, ?, ?, ?, 'active')`,
            [username, email || null, passwordHash, role]
        );

        return NextResponse.json({
            id: result.insertId,
            username,
            email,
            role,
            status: 'active'
        }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// PUT /api/users - 更新用户
export async function PUT(req: NextRequest) {
    try {
        const user = await getSession();

        // 只有 admin 可以更新用户
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { id, username, email, password, role, status } = body;

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 构建更新语句
        const updates: string[] = [];
        const values: any[] = [];

        if (username) {
            updates.push('username = ?');
            values.push(username);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email || null);
        }
        if (password) {
            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(password, salt);
            updates.push('password_hash = ?');
            values.push(passwordHash);
        }
        if (role) {
            updates.push('role = ?');
            values.push(role);
        }
        if (status) {
            updates.push('status = ?');
            values.push(status);
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        values.push(id);
        await pool.query(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return NextResponse.json({ message: 'User updated successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/users?id={id} - 删除用户
export async function DELETE(req: NextRequest) {
    try {
        const user = await getSession();

        // 只有 admin 可以删除用户
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        // 不能删除自己
        if (parseInt(id) === user.id) {
            return NextResponse.json(
                { error: 'Cannot delete yourself' },
                { status: 400 }
            );
        }

        await pool.query('DELETE FROM users WHERE id = ?', [id]);

        return NextResponse.json({ message: 'User deleted successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
