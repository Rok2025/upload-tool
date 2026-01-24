import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        // 1. Auth Check - just need to be logged in to see own status
        const user = await getSession();
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
                e.name as environment_name,
                e.host as environment_host,
                e.port as environment_port
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

        const deployLogIds = rows.map((r: any) => r.id);
        let stepsByLogId: Record<number, any[]> = {};

        if (deployLogIds.length > 0) {
            const [stepRows]: any = await pool.query(
                `
                SELECT 
                    deploy_log_id,
                    step_key,
                    section,
                    status,
                    message,
                    order_index,
                    started_at,
                    finished_at
                FROM deploy_log_steps
                WHERE deploy_log_id IN (${deployLogIds.map(() => '?').join(',')})
                ORDER BY deploy_log_id DESC, order_index ASC
                `,
                deployLogIds
            );

            stepsByLogId = stepRows.reduce((acc: Record<number, any[]>, s: any) => {
                const id = s.deploy_log_id;
                if (!acc[id]) acc[id] = [];
                acc[id].push(s);
                return acc;
            }, {});
        }

        const result = rows.map((r: any) => ({
            ...r,
            steps: stepsByLogId[r.id] || []
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('[DeployStatus] Error fetching status:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
