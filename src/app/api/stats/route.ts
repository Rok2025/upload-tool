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
            const today = new Date().toISOString().split('T')[0];
            const [todayRows]: any = await pool.query(
                'SELECT COUNT(*) as count FROM deploy_logs WHERE DATE(created_at) = ?',
                [today]
            );
            todayDeployCount = todayRows[0].count;

            const [recentRows]: any = await pool.query(
                `SELECT dl.*, p.name as project_name, m.name as module_name 
                 FROM deploy_logs dl
                 LEFT JOIN projects p ON dl.project_id = p.id
                 LEFT JOIN modules m ON dl.module_id = m.id
                 ORDER BY dl.created_at DESC LIMIT 10`
            );
            recentDeployments = recentRows;
        } catch {
            // deploy_logs table might not exist yet
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
