import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        // Get total project count
        const [projectRows]: any = await pool.query('SELECT COUNT(*) as count FROM projects');
        const projectCount = projectRows[0].count;

        // Get total module count
        const [moduleRows]: any = await pool.query('SELECT COUNT(*) as count FROM modules');
        const moduleCount = moduleRows[0].count;

        // Get environment count
        const [envRows]: any = await pool.query('SELECT COUNT(*) as count FROM environments');
        const envCount = envRows[0].count;

        // Get recent deployment logs (if deploy_logs table exists)
        let todayDeployCount = 0;
        let recentDeployments: any[] = [];

        try {
            // Get today's range in local time (relative to server)
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            const [todayRows]: any = await pool.query(
                'SELECT COUNT(*) as count FROM deploy_logs WHERE start_time >= ?',
                [startOfToday]
            );
            todayDeployCount = todayRows[0].count;

            const [recentRows]: any = await pool.query(
                `SELECT dl.*, p.name as project_name, m.name as module_name, e.name as environment_name
                 FROM deploy_logs dl
                 LEFT JOIN modules m ON dl.module_id = m.id
                 LEFT JOIN projects p ON m.project_id = p.id
                 LEFT JOIN environments e ON dl.environment_id = e.id
                 ORDER BY dl.start_time DESC LIMIT 5`
            );
            recentDeployments = recentRows;
        } catch (err) {
            console.error('[Stats API Error]: Failed to fetch deploy logs:', err);
            // deploy_logs table might not exist yet or has schema mismatch
        }

        return NextResponse.json({
            projectCount,
            moduleCount,
            envCount,
            todayDeployCount,
            recentDeployments,
            systemStatus: 'online'
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
