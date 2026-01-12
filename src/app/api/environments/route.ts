import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { encrypt } from '@/lib/crypto';
import { getSession } from '@/lib/auth';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const [rows]: any = await pool.query('SELECT id, name, host, port, username, last_test_status, last_test_message FROM environments ORDER BY created_at DESC');
        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { name, host, port, username, password } = await req.json();
        const encryptedPassword = encrypt(password);

        const [result]: any = await pool.query(
            'INSERT INTO environments (name, host, port, username, password_encrypted) VALUES (?, ?, ?, ?, ?)',
            [name, host, port || 22, username, encryptedPassword]
        );

        return NextResponse.json({ id: result.insertId, name });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { id, name, host, port, username, password } = await req.json();

        if (password) {
            const encryptedPassword = encrypt(password);
            await pool.query(
                'UPDATE environments SET name = ?, host = ?, port = ?, username = ?, password_encrypted = ? WHERE id = ?',
                [name, host, port || 22, username, encryptedPassword, id]
            );
        } else {
            await pool.query(
                'UPDATE environments SET name = ?, host = ?, port = ?, username = ? WHERE id = ?',
                [name, host, port || 22, username, id]
            );
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        await pool.query('DELETE FROM environments WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
