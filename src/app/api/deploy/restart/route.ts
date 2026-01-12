import { NextRequest, NextResponse } from 'next/server';
import { SSHService } from '@/lib/ssh';
import { decrypt } from '@/lib/crypto';
import pool from '@/lib/db';
import { requireDeployPermission } from '@/lib/permissions';

export async function POST(req: NextRequest) {
    const ssh = new SSHService();
    try {
        const { moduleId, environmentId } = await req.json();

        // 1. Permission Check
        const user = await requireDeployPermission(req, null as any);
        if (!user) {
            return NextResponse.json({ error: '未登录或会话已过期。' }, { status: 401 });
        }

        // 2. Fetch Module & Environment Info
        const [moduleRow]: any = await pool.query(`
            SELECT m.*, p.environment_id as project_environment_id
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
        if (!effectiveEnvironmentId) {
            return NextResponse.json({ error: '尚未配置部署环境。' }, { status: 400 });
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

        const effectiveRestartCommand = config?.restart_command || module.restart_command;
        const effectiveStartCommand = config?.start_command || module.start_command;
        const restartCmd = effectiveRestartCommand || effectiveStartCommand;

        if (!restartCmd) {
            return NextResponse.json({ error: '未配置重启命令或启动命令。' }, { status: 400 });
        }

        // 4. SSH & Execute
        const [envRow]: any = await pool.query('SELECT * FROM environments WHERE id = ?', [effectiveEnvironmentId]);
        if (!envRow.length) {
            return NextResponse.json({ error: '找不到部署环境。' }, { status: 404 });
        }
        const env = envRow[0];
        const password = decrypt(env.password_encrypted);

        await ssh.connect({
            host: env.host,
            port: env.port,
            username: env.username,
            password: password
        });

        console.log(`[Restart] Executing: ${restartCmd}`);
        const result = await ssh.exec(restartCmd);

        // Log the action
        await pool.query(
            'INSERT INTO deploy_logs (user_id, module_id, environment_id, status, log_output) VALUES (?, ?, ?, ?, ?)',
            [user.id, moduleId, effectiveEnvironmentId, 'success', `Manual Restart Executed: ${restartCmd}`]
        );

        return NextResponse.json({ message: '重启命令已发送', output: result.stdout });

    } catch (error: any) {
        console.error('[Restart API Error]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    } finally {
        ssh.disconnect();
    }
}
