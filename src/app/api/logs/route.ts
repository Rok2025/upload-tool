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

    const [moduleRow]: any = await pool.query('SELECT log_path FROM modules WHERE id = ?', [moduleId]);
    const [envRow]: any = await pool.query('SELECT host, port, username, password_encrypted FROM environments WHERE id = ?', [envId]);

    if (!moduleRow.length || !envRow.length) {
        return new Response('Config not found', { status: 404 });
    }

    const logPath = moduleRow[0].log_path;
    if (!logPath) return new Response('Log path not configured', { status: 400 });

    const env = envRow[0];
    const ssh = new SSHService();

    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();

            try {
                await ssh.connect({
                    host: env.host,
                    port: env.port,
                    username: env.username,
                    password: decrypt(env.password_encrypted)
                });

                const channel = await ssh.tailStream(logPath, (data) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: data })}\n\n`));
                });

                req.signal.addEventListener('abort', () => {
                    channel.close();
                    ssh.disconnect();
                    controller.close();
                });

            } catch (err: any) {
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
