import { NextRequest, NextResponse } from 'next/server';
import { SSHService } from '@/lib/ssh';
import { decrypt } from '@/lib/crypto';
import pool from '@/lib/db';
import path from 'path';

import { requireDeployPermission } from '@/lib/permissions';

export async function POST(req: NextRequest) {
    const ssh = new SSHService();
    let currentUserId: number | null = null;
    let currentModuleId: any = null;
    let currentEnvId: any = null;
    const deployStartTime = new Date();

    try {
        const body = await req.json();
        const { moduleId: bodyModuleId, environmentId: bodyEnvironmentId, fileName, skipRestart } = body;
        currentModuleId = bodyModuleId;
        currentEnvId = bodyEnvironmentId;
        console.log(`[Deploy] Received request for moduleId: ${currentModuleId}, environmentId: ${currentEnvId}`);

        // 1. Permission Check
        console.log(`[Deploy] Checking base permissions for user...`);
        const user = await requireDeployPermission(req, null as any);
        if (!user) {
            console.warn(`[Deploy] Unauthorized access attempt or session expired.`);
            return NextResponse.json({ error: '未登录或会话已过期。' }, { status: 401 });
        }
        currentUserId = user.id;
        console.log(`[Deploy] User authenticated: ${user.username} (ID: ${user.id})`);

        // 0. Initial Log (New Strategy: Persistence)
        console.log(`[Deploy] Initializing 'deploying' status in DB...`);
        const [initResult]: any = await pool.query(
            'INSERT INTO deploy_logs (user_id, module_id, environment_id, status, log_type, version, start_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [currentUserId, currentModuleId, currentEnvId, 'deploying', 'deploy', 'pending', deployStartTime] // version pending until generated
        );
        const logId = initResult.insertId;
        console.log(`[Deploy] Log record created with ID: ${logId}`);

        // 3. Fetch Module & Environment Info
        console.log(`[Deploy] Fetching module info for ID: ${currentModuleId}`);
        const [moduleRow]: any = await pool.query(`
            SELECT m.*, p.environment_id as project_environment_id, p.base_path as project_base_path
            FROM modules m
            JOIN projects p ON m.project_id = p.id
            WHERE m.id = ?
        `, [currentModuleId]);

        if (!moduleRow.length) {
            console.error(`[Deploy] Module not found: ${currentModuleId}`);
            // Fail log
            await pool.query(
                'UPDATE deploy_logs SET status = ?, log_output = ?, end_time = ? WHERE id = ?',
                ['failed', '找不到该模块配置', new Date(), logId]
            );
            return NextResponse.json({ error: '找不到该模块配置，请先在【项目配置】中添加。' }, { status: 404 });
        }
        const module = moduleRow[0];
        console.log(`[Deploy] Module found: ${module.name}, Project ID: ${module.project_id}`);

        // Determine environmentId
        const effectiveEnvironmentId = bodyEnvironmentId || module.project_environment_id;
        currentEnvId = effectiveEnvironmentId;

        // Update Log with correct Environment ID if it changed (though usually body has it)
        if (effectiveEnvironmentId !== bodyEnvironmentId) {
            await pool.query('UPDATE deploy_logs SET environment_id = ? WHERE id = ?', [effectiveEnvironmentId, logId]);
        }

        if (!effectiveEnvironmentId) {
            const msg = '该项目尚未配置服务器，请先在【项目配置】中绑定服务器。';
            await pool.query(
                'UPDATE deploy_logs SET status = ?, log_output = ?, end_time = ? WHERE id = ?',
                ['failed', msg, new Date(), logId]
            );
            return NextResponse.json({ error: msg }, { status: 400 });
        }

        // 3. Fetch Environment-specific Configuration
        console.log(`[Deploy] Fetching env-specific config for module ${currentModuleId} on env ${effectiveEnvironmentId}`);
        const [configRow]: any = await pool.query(
            'SELECT * FROM module_env_configs WHERE module_id = ? AND environment_id = ?',
            [currentModuleId, effectiveEnvironmentId]
        );

        const config = configRow.length > 0 ? configRow[0] : null;
        const rawRemotePath = config?.remote_path || module.remote_path;
        const effectiveStartCommand = config?.start_command || module.start_command;
        const effectiveStopCommand = config?.stop_command || module.stop_command;
        const effectiveRestartCommand = config?.restart_command || module.restart_command;

        // Path concatenation
        const basePath = module.project_base_path || '';
        const effectiveRemotePath = path.join(basePath, rawRemotePath || '');
        console.log(`[Deploy] Resolved remote path: ${effectiveRemotePath}`);

        if (!effectiveRemotePath || effectiveRemotePath === '.') {
            await pool.query(
                'UPDATE deploy_logs SET status = ?, log_output = ?, end_time = ? WHERE id = ?',
                ['failed', '解析后的部署路径不能为空。', new Date(), logId]
            );
            return NextResponse.json({ error: '解析后的部署路径不能为空。' }, { status: 400 });
        }

        // Project Permission Check
        console.log(`[Deploy] Checking project-specific deploy permission...`);
        if (user.role !== 'admin' && !(await requireDeployPermission(req, module.project_id))) {
            const msg = '您没有该项目的部署权限。';
            await pool.query(
                'UPDATE deploy_logs SET status = ?, log_output = ?, end_time = ? WHERE id = ?',
                ['failed', msg, new Date(), logId]
            );
            return NextResponse.json({ error: msg }, { status: 403 });
        }
        console.log(`[Deploy] Permission granted.`);

        const [envRow]: any = await pool.query('SELECT * FROM environments WHERE id = ?', [effectiveEnvironmentId]);
        if (!envRow.length) {
            await pool.query(
                'UPDATE deploy_logs SET status = ?, log_output = ?, end_time = ? WHERE id = ?',
                ['failed', '找不到服务器配置。', new Date(), logId]
            );
            return NextResponse.json({ error: '找不到服务器配置。' }, { status: 404 });
        }
        const env = envRow[0];
        console.log(`[Deploy] Connecting to server: ${env.host}:${env.port} as ${env.username}`);

        const password = decrypt(env.password_encrypted);
        const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads/tmp');
        const localFilePath = path.join(uploadDir, fileName);
        const remoteDestPath = path.join(effectiveRemotePath, fileName);

        console.log(`[Deploy] Looking for local file at: ${localFilePath}`);

        // Check if file exists before attempting upload
        const fs = await import('fs/promises');
        try {
            await fs.access(localFilePath);
            const stats = await fs.stat(localFilePath);
            console.log(`[Deploy] File found! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        } catch (error: any) {
            const msg = `No such file: ${fileName}`;
            await pool.query(
                'UPDATE deploy_logs SET status = ?, log_output = ?, end_time = ? WHERE id = ?',
                ['failed', msg, new Date(), logId]
            );
            throw new Error(msg);
        }

        await ssh.connect({
            host: env.host,
            port: env.port,
            username: env.username,
            password: password
        });
        console.log(`[Deploy] SSH Connected.`);

        // 3. OS Detection
        console.log(`[Deploy] Detecting Target OS...`);
        let osType = 'linux';
        try {
            const unameResult = await ssh.exec('uname -s');
            const stdout = unameResult.stdout.toLowerCase();
            if (stdout.includes('linux')) {
                osType = 'linux';
            } else if (stdout.includes('darwin')) {
                osType = 'linux'; // Mac behaves like Linux/Unix
            } else {
                osType = 'windows';
            }
        } catch (e) {
            console.warn(`[Deploy] OS detection failed, defaulting to Linux. Error: ${e}`);
        }
        console.log(`[Deploy] Detected OS: ${osType}`);

        // Generate Suffix: YYMMDDHHmm
        const now = new Date();
        const suffix = now.getFullYear().toString().substring(2) +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0');

        // Update version in DB now that we have it
        await pool.query('UPDATE deploy_logs SET version = ? WHERE id = ?', [suffix, logId]);

        const ext = path.extname(fileName);
        const basename = path.basename(fileName, ext);
        const backupFileName = `${basename}${suffix}${ext}`;
        const backupDir = module.backup_path || effectiveRemotePath;
        const backupPath = path.join(backupDir, backupFileName);
        const remoteNewPath = remoteDestPath + "_new";
        const isZip = module.type === 'zip' || fileName.toLowerCase().endsWith('.zip');
        const uploadDestPath = isZip ? remoteDestPath : remoteNewPath;

        // Ensure remote directories exist before upload
        console.log(`[Deploy] Ensuring remote directories exist...`);
        const remoteDir = path.dirname(uploadDestPath);
        await ssh.exec(`mkdir -p "${remoteDir}"`);
        if (backupDir !== effectiveRemotePath) {
            await ssh.exec(`mkdir -p "${backupDir}"`);
        }
        console.log(`[Deploy] Remote directories ready.`);

        console.log(`[Deploy] Uploading ${isZip ? 'ZIP ' : ''}package: ${localFilePath} -> ${uploadDestPath}`);
        await ssh.putFile(localFilePath, uploadDestPath);

        if (isZip) {
            console.log(`[Deploy] ZIP package detected, performing backup and unzip...`);
            const parentDir = path.dirname(remoteDestPath);
            const backupFileNameLocal = `${basename}${suffix}.zip`;

            // 1. Backup existing directory if it exists
            console.log(`[Deploy] Creating backup of existing directory if it exists...`);
            await ssh.exec(`cd "${parentDir}" && [ -d "${basename}" ] && zip -r "${backupFileNameLocal}" "${basename}" || echo "No directory to backup"`);

            // 2. Unzip new package
            console.log(`[Deploy] Unzipping new package: ${fileName}`);
            await ssh.exec(`cd "${parentDir}" && unzip -o "${fileName}"`);

            const restartCmd = effectiveRestartCommand || effectiveStartCommand;
            if (restartCmd && !skipRestart) {
                console.log(`[Deploy] Running restart/start command in ${parentDir}: ${restartCmd}`);
                const fullRestartCmd = `cd "${parentDir}" && ${restartCmd}`;
                const restartResult = await ssh.exec(fullRestartCmd);
                console.log(`[Deploy] Restart command output:`, restartResult.stdout);
                if (restartResult.stderr) {
                    console.warn(`[Deploy] Restart command stderr:`, restartResult.stderr);
                }
            } else if (!restartCmd) {
                console.warn(`[Deploy] No restart command configured for this module.`);
            } else if (skipRestart) {
                console.log(`[Deploy] Skip Restart requested by user.`);
            }
        } else if (osType === 'linux') {
            console.log(`[Deploy] Using Linux Seamless Swap Strategy...`);
            // Swap files (Linux supports renaming even if active)
            await ssh.exec(`[ -f "${remoteDestPath}" ] && mv "${remoteDestPath}" "${backupPath}"`);
            await ssh.exec(`mv "${remoteNewPath}" "${remoteDestPath}"`);

            const restartCmd = effectiveRestartCommand || effectiveStartCommand;
            if (restartCmd && !skipRestart) {
                console.log(`[Deploy] Running Linux restart/start command in ${effectiveRemotePath}: ${restartCmd}`);
                const fullRestartCmd = `cd "${effectiveRemotePath}" && ${restartCmd}`;
                const restartResult = await ssh.exec(fullRestartCmd);
                console.log(`[Deploy] Restart command output:`, restartResult.stdout);
                if (restartResult.stderr) {
                    console.warn(`[Deploy] Restart command stderr:`, restartResult.stderr);
                }
            } else if (!restartCmd) {
                console.warn(`[Deploy] No restart command configured for this module.`);
            } else if (skipRestart) {
                console.log(`[Deploy] Skip Restart requested by user.`);
            }

            console.log(`[Deploy] Cleaning up old versions (Keep latest 3)...`);
            // List backups, exclude active, skip top 3, delete the rest
            const remoteFileName = path.basename(remoteDestPath);
            await ssh.exec(`cd "${backupDir}" && ls -1t ${basename}*${ext} | grep -v "^${remoteFileName}$" | tail -n +4 | xargs rm -f`);

        } else {
            console.log(`[Deploy] Using Windows Stop-Replace Strategy...`);
            // Windows requires stopping the process before renaming/replacing
            // Even if skipRestart is true, we MUST stop to swap files if they are locked.

            if (effectiveStopCommand) {
                console.log(`[Deploy] Stopping Windows service: ${effectiveStopCommand}`);
                await ssh.exec(effectiveStopCommand);
            }

            // Small delay to let process release lock if needed
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Windows Rename (cmd /c move /y)
            await ssh.exec(`cmd /c if exist "${remoteDestPath}" move /y "${remoteDestPath}" "${backupPath}"`);
            await ssh.exec(`cmd /c move /y "${remoteNewPath}" "${remoteDestPath}"`);

            const restartCmd = effectiveRestartCommand || effectiveStartCommand;
            if (restartCmd && !skipRestart) {
                console.log(`[Deploy] Starting Windows service in ${effectiveRemotePath}: ${restartCmd}`);
                const fullRestartCmd = `cd /d "${effectiveRemotePath}" && ${restartCmd}`;
                const restartResult = await ssh.exec(fullRestartCmd);
                console.log(`[Deploy] Restart command output:`, restartResult.stdout);
                if (restartResult.stderr) {
                    console.warn(`[Deploy] Restart command stderr:`, restartResult.stderr);
                }
            } else if (!restartCmd) {
                console.warn(`[Deploy] No restart command configured for this module.`);
            } else if (skipRestart) {
                console.log(`[Deploy] Skip Restart requested by user.`);
            }

            // Windows Cleanup (Keep latest 3)
            console.log(`[Deploy] Windows cleanup initiated...`);
            await ssh.exec(`powershell -Command "Get-ChildItem -Path '${backupDir}' -Filter '${basename}*${ext}' | Sort-Object LastWriteTime -Descending | Select-Object -Skip 4 | Remove-Item -Force"`);
        }

        // 4. Log Success
        console.log(`[Deploy] Recording success log to DB...`);
        const deployEndTime = new Date();
        await pool.query(
            'UPDATE deploy_logs SET status = ?, end_time = ? WHERE id = ?',
            ['success', deployEndTime, logId]
        );

        console.log(`[Deploy] All steps completed successfully.`);
        return NextResponse.json({ message: 'Deployment successful', version: suffix });

    } catch (error: any) {
        console.error('==================== DEPLOYMENT ERROR ====================');
        console.error(`Timestamp: ${new Date().toLocaleString()}`);
        console.error(`User ID: ${currentUserId}`);
        console.error(`Module ID: ${currentModuleId}`);
        console.error(`Env ID: ${currentEnvId}`);
        console.error('Error Stack:', error.stack || error);
        console.error('==========================================================');

        let errorMsg = error.message;
        if (error.code === 'ETIMEDOUT' || error.message.includes('Timed out')) {
            errorMsg = '连接服务器超时，请检查服务器 IP 和端口。';
        } else if (error.message.includes('Authentication failure')) {
            errorMsg = '身份验证失败，请检查用户名和密码。';
        }

        // Fix: Use UPDATE instead of INSERT for failure too, if logId exists
        if (currentUserId && currentModuleId && currentEnvId) {
            // We can't access logId easily in catch block if it's declared in try, 
            // but since we are refactoring, let's just do a best effort Insert if update fails or handle it better.
            // Actually, let's rely on logId if we can move it up scope? 
            // For this patch, I'll assume I can't easily move scope without breaking structure too much
            // But wait, I'm replacing the whole block. I can structure it better.
            // Let's assume logId is available if I move it? No, it's inside Try.
            // I will try to fetch the latest running log for this user/module to update it, OR just insert a new one if I can't find it.
            // Actually, for simplicity and reliability, I will query for the 'running' log I just created.
            try {
                // Try to find the running log for this module/env/user started recently
                const [rows]: any = await pool.query(
                    'SELECT id FROM deploy_logs WHERE user_id = ? AND module_id = ? AND status = "deploying" ORDER BY id DESC LIMIT 1',
                    [currentUserId, currentModuleId]
                );
                if (rows.length > 0) {
                    await pool.query(
                        'UPDATE deploy_logs SET status = ?, log_output = ?, end_time = ? WHERE id = ?',
                        ['failed', errorMsg, new Date(), rows[0].id]
                    );
                } else {
                    // Fallback to insert
                    await pool.query(
                        'INSERT INTO deploy_logs (user_id, module_id, environment_id, status, log_type, log_output, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [currentUserId, currentModuleId, currentEnvId, 'failed', 'deploy', errorMsg, deployStartTime, new Date()]
                    );
                }
            } catch (logError) {
                console.error('[Deploy] FATAL: Failed to log error to DB:', logError);
            }
        }

        return NextResponse.json({ error: errorMsg }, { status: 500 });
    } finally {
        ssh.disconnect();
    }
}
