import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '15');
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status');
        const moduleId = searchParams.get('moduleId');
        const projectId = searchParams.get('projectId');
        const environmentId = searchParams.get('environmentId');
        const logType = searchParams.get('logType');

        let whereClauses = ['1=1'];
        const queryParams: any[] = [];

        // Role-based filtering
        if (session.role !== 'admin') {
            whereClauses.push('dl.user_id = ?');
            queryParams.push(session.id);
        }

        if (status) {
            whereClauses.push('dl.status = ?');
            queryParams.push(status);
        }

        if (moduleId) {
            whereClauses.push('dl.module_id = ?');
            queryParams.push(parseInt(moduleId));
        }

        if (projectId) {
            whereClauses.push('p.id = ?');
            queryParams.push(parseInt(projectId));
        }

        if (environmentId) {
            whereClauses.push('dl.environment_id = ?');
            queryParams.push(parseInt(environmentId));
        }

        if (logType) {
            whereClauses.push('dl.log_type = ?');
            queryParams.push(logType);
        }

        const whereString = whereClauses.join(' AND ');

        let query = `
            SELECT 
                dl.*, u.username, m.name as module_name, m.type as module_type, p.name as project_name, p.id as project_id, e.name as environment_name
            FROM deploy_logs dl
            JOIN users u ON dl.user_id = u.id
            JOIN modules m ON dl.module_id = m.id
            JOIN projects p ON m.project_id = p.id
            LEFT JOIN environments e ON dl.environment_id = e.id
            WHERE ${whereString}
            ORDER BY dl.start_time DESC
            LIMIT ? OFFSET ?
        `;

        const [rows]: any = await pool.query(query, [...queryParams, limit, offset]);

        // Total count for pagination
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM deploy_logs dl 
            JOIN modules m ON dl.module_id = m.id 
            JOIN projects p ON m.project_id = p.id 
            WHERE ${whereString}
        `;
        const [countRows]: any = await pool.query(countQuery, queryParams);
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
        console.error('Fetch logs error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
