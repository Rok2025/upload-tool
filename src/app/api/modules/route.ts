import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { project_id, name, type, remote_path, log_path, start_command, stop_command, restart_command, backup_path } = await req.json();

        const [result]: any = await pool.query(
            `INSERT INTO modules (project_id, name, type, remote_path, log_path, start_command, stop_command, restart_command, backup_path) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [project_id, name, type, remote_path, log_path, start_command, stop_command, restart_command, backup_path]
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
        const { id, name, type, remote_path, log_path, start_command, stop_command, restart_command, backup_path } = await req.json();

        // DEBUG: Log the restart_command value
        console.log('[Modules PUT] Received data:');
        console.log('[Modules PUT] restart_command:', restart_command);
        console.log('[Modules PUT] Full payload:', { id, name, type, remote_path, log_path, start_command, stop_command, restart_command, backup_path });

        await pool.query(
            `UPDATE modules SET name = ?, type = ?, remote_path = ?, log_path = ?, start_command = ?, stop_command = ?, restart_command = ?, backup_path = ? WHERE id = ?`,
            [name, type, remote_path, log_path, start_command, stop_command, restart_command, backup_path, id]
        );

        console.log('[Modules PUT] Update successful for module ID:', id);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[Modules PUT] Error:', error);
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

        await pool.query('DELETE FROM modules WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
