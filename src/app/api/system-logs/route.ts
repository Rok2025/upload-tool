import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const level = searchParams.get('level') || '';
        const category = searchParams.get('category') || '';
        const keyword = searchParams.get('keyword') || '';
        const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
        const offset = parseInt(searchParams.get('offset') || '0');

        let where = 'WHERE 1=1';
        const params: (string | number)[] = [];

        if (level) {
            where += ' AND level = ?';
            params.push(level);
        }
        if (category) {
            where += ' AND category = ?';
            params.push(category);
        }
        if (keyword) {
            where += ' AND (message LIKE ? OR detail LIKE ? OR target_host LIKE ? OR action LIKE ?)';
            const like = `%${keyword}%`;
            params.push(like, like, like, like);
        }

        // Count total
        const [countRows]: any = await pool.query(
            `SELECT COUNT(*) as total FROM system_logs ${where}`,
            params
        );
        const total = countRows[0].total;

        // Fetch logs
        const [rows]: any = await pool.query(
            `SELECT * FROM system_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        return NextResponse.json({
            logs: rows,
            pagination: { total, limit, offset, hasMore: offset + limit < total }
        });
    } catch (error: any) {
        console.error('[SystemLogs] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
