import { NextRequest, NextResponse } from 'next/server';
import { SSHService } from '@/lib/ssh';
import { decrypt } from '@/lib/crypto';
import pool from '@/lib/db';
import path from 'path';
import { requireDeployPermission } from '@/lib/permissions';

export async function POST(req: NextRequest) {
    const ssh = new SSHService();
    let currentModuleId = null;
    let currentEnvId = null;
    let start_time = new Date();
    try {
        const { moduleId, environmentId } = await req.json();
        currentModuleId = moduleId;
        currentEnvId = environmentId || null;

        // 1. Permission Check
        const user = await requireDeployPermission(req, null as any);
        if (!user) {
            return NextResponse.json({ error: '未登录或会话已过期。' }, { status: 401 });
        }

        // 2. Fetch Module & Environment Info
        const [moduleRow]: any = await pool.query(`
            SELECT m.*, p.environment_id as project_environment_id, p.base_path as project_base_path
            FROM modules m
            JOIN projects p ON m.project_id = p.id
            WHERE m.id = ?
        `, [moduleId]);

        if (!moduleRow.length) {
            return NextResponse.json({ error: '找不到该模块配置。' }, { status: 404 });
        }
        const module = moduleRow[0];

        // Determine environment
        const effectiveEnvironmentId = environmentId || module.project_environment_id;
        currentEnvId = effectiveEnvironmentId;
        if (!effectiveEnvironmentId) {
            return NextResponse.json({ error: '尚未配置服务器。' }, { status: 400 });
        }

        // Project Permission Check
        if (user.role !== 'admin' && !(await requireDeployPermission(req, module.project_id))) {
            return NextResponse.json({ error: '您没有该项目的操作权限。' }, { status: 403 });
        }

        // 3. Fetch Config Overrides
        const [configRow]: any = await pool.query(
            'SELECT * FROM module_env_configs WHERE module_id = ? AND environment_id = ?',
            [moduleId, effectiveEnvironmentId]
        );
        const config = configRow.length > 0 ? configRow[0] : null;

        const stopCmd = config?.stop_command || module.stop_command;

        const rawRemotePath = config?.remote_path || module.remote_path;
        const basePath = module.project_base_path || '';
        const effectiveRemotePath = path.join(basePath, rawRemotePath || '');

        if (!stopCmd) {
            return NextResponse.json({ error: '未配置停止命令。' }, { status: 400 });
        }

        // 4. SSH & Execute
        const [envRow]: any = await pool.query('SELECT * FROM environments WHERE id = ?', [effectiveEnvironmentId]);
        if (!envRow.length) {
            return NextResponse.json({ error: '找不到服务器。' }, { status: 404 });
        }
        const env = envRow[0];
        const password = decrypt(env.password_encrypted);

        await ssh.connect({
            host: env.host,
            port: env.port,
            username: env.username,
            password: password
        });

        const fullStopCmd = effectiveRemotePath ? `cd "${effectiveRemotePath}" && ${stopCmd}` : stopCmd;
        console.log(`[Stop Service] Executing: ${fullStopCmd}`);
        const result = await ssh.exec(fullStopCmd);

        // Log the action (Success Path)
        await pool.query(
            'INSERT INTO deploy_logs (user_id, module_id, environment_id, status, log_type, log_output, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user.id, moduleId, effectiveEnvironmentId, 'success', 'stop', `Manual Stop Executed: ${fullStopCmd}`, start_time, new Date()]
        );

        return NextResponse.json({ message: '停止命令已发送', output: result.stdout });

    } catch (error: any) {
        console.error('[Stop API Error]:', error);
        if (currentModuleId && currentEnvId) {
            try {
                const user = await requireDeployPermission(req, null as any);
                if (user) {
                    await pool.query(
                        'INSERT INTO deploy_logs (user_id, module_id, environment_id, status, log_type, log_output, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [user.id, currentModuleId, currentEnvId, 'failed', 'stop', error.message, start_time, new Date()]
                    );
                }
            } catch (innerError) {
                console.error('[Stop API] Failed to log failure:', innerError);
            }
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        ssh.disconnect();
    }
}
