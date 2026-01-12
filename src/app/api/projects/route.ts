import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // Get all projects with environment info
        const [projects]: any = await pool.query(`
            SELECT p.*, e.name as environment_name 
            FROM projects p
            LEFT JOIN environments e ON p.environment_id = e.id
            ORDER BY p.created_at DESC
        `);

        // Get modules for each project
        for (const project of projects) {
            const [modules]: any = await pool.query(
                'SELECT id, name, type, remote_path, log_path, start_command, stop_command, restart_command, backup_path FROM modules WHERE project_id = ?',
                [project.id]
            );

            // Get environment configurations for each module (keep for now as advanced override)
            for (const module of modules) {
                const [configs]: any = await pool.query(
                    `SELECT mec.*, e.name as environment_name 
                     FROM module_env_configs mec
                     JOIN environments e ON mec.environment_id = e.id
                     WHERE mec.module_id = ?`,
                    [module.id]
                );
                module.env_configs = configs;
            }

            project.modules = modules;
        }

        return NextResponse.json(projects);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { name, description, environment_id, base_path } = await req.json();
        const [result]: any = await pool.query(
            'INSERT INTO projects (name, description, environment_id, base_path) VALUES (?, ?, ?, ?)',
            [name, description, environment_id, base_path]
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
        const { id, name, description, environment_id, base_path: newBasePath } = await req.json();

        // 1. Fetch old project data to get current base_path
        const [oldProjects]: any = await pool.query('SELECT base_path FROM projects WHERE id = ?', [id]);
        if (oldProjects.length === 0) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        const oldBasePath = oldProjects[0].base_path;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 2. Update the project itself
            await connection.query(
                'UPDATE projects SET name = ?, description = ?, environment_id = ?, base_path = ? WHERE id = ?',
                [name, description, environment_id, newBasePath, id]
            );

            // 3. If base_path changed, rebase associated module paths
            if (oldBasePath && newBasePath && oldBasePath !== newBasePath) {
                // Determine if it's an absolute path migration (e.g., /data/v1 -> /data/v2)

                // A. Update modules table
                const [modules]: any = await connection.query('SELECT id, remote_path FROM modules WHERE project_id = ?', [id]);
                for (const m of modules) {
                    if (m.remote_path && m.remote_path.startsWith(oldBasePath)) {
                        const newRemotePath = m.remote_path.replace(oldBasePath, newBasePath);
                        await connection.query('UPDATE modules SET remote_path = ? WHERE id = ?', [newRemotePath, m.id]);
                    }
                }

                // B. Update module_env_configs table
                const [configs]: any = await connection.query(`
                    SELECT mec.id, mec.remote_path 
                    FROM module_env_configs mec
                    JOIN modules m ON mec.module_id = m.id
                    WHERE m.project_id = ?
                `, [id]);
                for (const c of configs) {
                    if (c.remote_path && c.remote_path.startsWith(oldBasePath)) {
                        const newRemotePath = c.remote_path.replace(oldBasePath, newBasePath);
                        await connection.query('UPDATE module_env_configs SET remote_path = ? WHERE id = ?', [newRemotePath, c.id]);
                    }
                }
            }

            await connection.commit();
            return NextResponse.json({ success: true });
        } catch (error: any) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error: any) {
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

        // Delete associated modules first
        await pool.query('DELETE FROM modules WHERE project_id = ?', [id]);
        // Delete project
        await pool.query('DELETE FROM projects WHERE id = ?', [id]);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
