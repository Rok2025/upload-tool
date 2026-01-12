import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

// GET /api/permissions?userId={id} - 获取用户的项目权限列表
export async function GET(req: NextRequest) {
    try {
        const user = await getSession();

        // 只有 admin 可以查看权限
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const [rows]: any = await pool.query(`
            SELECT 
                upp.id,
                upp.user_id,
                upp.project_id,
                upp.permission_type,
                upp.created_at,
                p.name as project_name,
                p.description as project_description
            FROM user_project_permissions upp
            LEFT JOIN projects p ON upp.project_id = p.id
            WHERE upp.user_id = ?
            ORDER BY p.name
        `, [userId]);

        return NextResponse.json(rows);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST /api/permissions - 分配权限
export async function POST(req: NextRequest) {
    try {
        const user = await getSession();

        // 只有 admin 可以分配权限
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const body = await req.json();
        const { userId, projectId, permissionType = 'view' } = body;

        if (!userId || !projectId) {
            return NextResponse.json(
                { error: 'userId and projectId are required' },
                { status: 400 }
            );
        }

        // 使用 INSERT ... ON DUPLICATE KEY UPDATE 处理已存在的情况
        await pool.query(`
            INSERT INTO user_project_permissions (user_id, project_id, permission_type)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE permission_type = VALUES(permission_type)
        `, [userId, projectId, permissionType]);

        return NextResponse.json({ message: 'Permission assigned successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/permissions?id={id} - 撤销权限
export async function DELETE(req: NextRequest) {
    try {
        const user = await getSession();

        // 只有 admin 可以撤销权限
        if (!user || user.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Permission ID is required' }, { status: 400 });
        }

        await pool.query('DELETE FROM user_project_permissions WHERE id = ?', [id]);

        return NextResponse.json({ message: 'Permission revoked successfully' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
