import { NextRequest } from 'next/server';
import { SSHService } from '@/lib/ssh';
import { decrypt } from '@/lib/crypto';
import pool from '@/lib/db';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const moduleId = searchParams.get('moduleId');
    const envId = searchParams.get('environmentId');

    if (!moduleId || !envId) {
        return new Response('Missing parameters', { status: 400 });
    }

    // Fetch module and project info (including base_path)
    const [moduleRow]: any = await pool.query(
        `SELECT m.log_path, p.base_path as project_base_path 
         FROM modules m 
         JOIN projects p ON m.project_id = p.id 
         WHERE m.id = ?`,
        [moduleId]
    );
    const [envRow]: any = await pool.query('SELECT host, port, username, password_encrypted FROM environments WHERE id = ?', [envId]);

    if (!moduleRow.length || !envRow.length) {
        return new Response('Config not found', { status: 404 });
    }

    const module = moduleRow[0];
    const rawLogPath = module.log_path;
    if (!rawLogPath) return new Response('Log path not configured', { status: 400 });

    // Concatenate base_path with log_path (similar to remote_path logic)
    const basePath = module.project_base_path || '';
    const logPath = basePath ? `${basePath}/${rawLogPath}`.replace(/\/+/g, '/') : rawLogPath;

    const env = envRow[0];
    const ssh = new SSHService();

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            try {
                console.log(`[SSE Log] Connecting to ${env.host}:${env.port} for log file: ${logPath}`);
                await ssh.connect({
                    host: env.host,
                    port: env.port,
                    username: env.username,
                    password: decrypt(env.password_encrypted)
                });
                console.log(`[SSE Log] Connected successfully. Starting tail on ${logPath}`);

                const channel = await ssh.tailStream(logPath, (data) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: data })}\n\n`));
                });

                req.signal.addEventListener('abort', () => {
                    console.log(`[SSE Log] Client disconnected. Closing channel and SSH.`);
                    channel.close();
                    ssh.disconnect();
                    controller.close();
                });

            } catch (err: any) {
                console.error(`[SSE Log] Error: ${err.message}`);
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
                ssh.disconnect();
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
