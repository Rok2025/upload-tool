import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status'); // 'success' | 'failed' | null
        const moduleId = searchParams.get('moduleId');
        const projectId = searchParams.get('projectId');

        let query = `
            SELECT 
                dl.id,
                dl.user_id,
                dl.module_id,
                dl.environment_id,
                dl.status,
                dl.version,
                dl.log_output,
                dl.start_time,
                dl.end_time,
                u.username,
                m.name as module_name,
                m.type as module_type,
                p.name as project_name,
                p.id as project_id,
                e.name as environment_name
            FROM deploy_logs dl
            JOIN users u ON dl.user_id = u.id
            JOIN modules m ON dl.module_id = m.id
            JOIN projects p ON m.project_id = p.id
            JOIN environments e ON dl.environment_id = e.id
            WHERE 1=1
        `;

        const params: any[] = [];

        if (status) {
            query += ' AND dl.status = ?';
            params.push(status);
        }

        if (moduleId) {
            query += ' AND dl.module_id = ?';
            params.push(parseInt(moduleId));
        }

        if (projectId) {
            query += ' AND p.id = ?';
            params.push(parseInt(projectId));
        }

        query += ' ORDER BY dl.start_time DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows]: any = await pool.query(query, params);

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM deploy_logs dl JOIN modules m ON dl.module_id = m.id JOIN projects p ON m.project_id = p.id WHERE 1=1';
        const countParams: any[] = [];

        if (status) {
            countQuery += ' AND dl.status = ?';
            countParams.push(status);
        }
        if (moduleId) {
            countQuery += ' AND dl.module_id = ?';
            countParams.push(parseInt(moduleId));
        }
        if (projectId) {
            countQuery += ' AND p.id = ?';
            countParams.push(parseInt(projectId));
        }

        const [countRows]: any = await pool.query(countQuery, countParams);
        const total = countRows[0].total;

        return NextResponse.json({
            logs: rows,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + rows.length < total
            }
        });
    } catch (error: any) {
        console.error('[Deploy Logs API Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
