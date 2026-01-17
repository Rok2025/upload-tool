import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireDeployPermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. Auth Check (Basic) - assumes cookies are sent
        const user = await requireDeployPermission(req, null as any);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Fetch Active Deployments
        // Logic: Get current 'running' tasks OR tasks finished in the last 15 seconds (for notifications)
        // We join with modules and projects to get friendly names.

        const [rows]: any = await pool.query(`
            SELECT 
                l.id, 
                l.module_id, 
                l.environment_id, 
                l.status, 
                l.start_time, 
                l.end_time,
                m.name as module_name,
                p.name as project_name,
                e.name as environment_name
            FROM deploy_logs l
            JOIN modules m ON l.module_id = m.id
            JOIN projects p ON m.project_id = p.id
            JOIN environments e ON l.environment_id = e.id
            WHERE 
                l.user_id = ? 
                AND (
                    l.status = 'deploying' 
                    OR 
                    l.end_time > DATE_SUB(NOW(), INTERVAL 15 SECOND)
                )
            ORDER BY l.id DESC
        `, [user.id]);

        return NextResponse.json(rows);
    } catch (error: any) {
        console.error('[DeployStatus] Error fetching status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
