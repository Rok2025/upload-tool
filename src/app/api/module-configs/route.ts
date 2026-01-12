import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/module-configs?moduleId={id} - 获取模块的所有环境配置
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const moduleId = searchParams.get('moduleId');

        if (!moduleId) {
            return NextResponse.json({ error: 'moduleId is required' }, { status: 400 });
        }

        const [rows]: any = await pool.query(`
            SELECT mec.*, e.name as environment_name 
            FROM module_env_configs mec
            JOIN environments e ON mec.environment_id = e.id
            WHERE mec.module_id = ?
        `, [moduleId]);

        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/module-configs - 创建或更新环境配置
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { module_id, environment_id, remote_path, start_command, stop_command, restart_command } = await req.json();

        if (!module_id || !environment_id || !remote_path) {
            return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
        }

        await pool.query(`
            INSERT INTO module_env_configs (module_id, environment_id, remote_path, start_command, stop_command, restart_command)
            VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                remote_path = VALUES(remote_path),
                start_command = VALUES(start_command),
                stop_command = VALUES(stop_command),
                restart_command = VALUES(restart_command)
        `, [module_id, environment_id, remote_path, start_command, stop_command, restart_command]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/module-configs?id={id} - 删除特定环境配置
export async function DELETE(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        await pool.query('DELETE FROM module_env_configs WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
