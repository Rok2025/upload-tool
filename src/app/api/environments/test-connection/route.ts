import { NextRequest, NextResponse } from 'next/server';
import { SSHService } from '@/lib/ssh';
import { decrypt } from '@/lib/crypto';
import pool from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ssh = new SSHService();
    let testId: any = null;
    try {
        const body = await req.json();
        const { id, host, port, username, password } = body;
        testId = id;

        let connectionConfig: any;

        if (id) {
            // Test existing environment
            const [rows]: any = await pool.query('SELECT * FROM environments WHERE id = ?', [id]);
            if (rows.length === 0) {
                return NextResponse.json({ error: 'Environment not found' }, { status: 404 });
            }
            const env = rows[0];
            connectionConfig = {
                host: env.host,
                port: env.port,
                username: env.username,
                password: decrypt(env.password_encrypted)
            };
        } else {
            // Test temporary connection info (from modal form)
            if (!host || !username || !password) {
                return NextResponse.json({ error: 'Missing connection details' }, { status: 400 });
            }
            connectionConfig = {
                host,
                port: port || 22,
                username,
                password
            };
        }

        // Attempt connection
        await ssh.connect(connectionConfig);

        // Execute a simple command to verify
        await ssh.exec('whoami');

        // Update database if it's an existing environment
        if (testId) {
            await pool.query(
                'UPDATE environments SET last_test_status = ?, last_test_message = ?, last_test_at = NOW() WHERE id = ?',
                ['success', '连接成功！', testId]
            );
        }

        return NextResponse.json({ success: true, message: '连接成功！' });
    } catch (error: any) {
        console.error('Connection test failed:', error);
        let errorMsg = error.message;

        if (error.code === 'ETIMEDOUT' || error.message.includes('Timed out')) {
            errorMsg = '连接超时，请检查 IP 端口是否正确或服务器防火墙设置。';
        } else if (error.message.includes('Authentication failure')) {
            errorMsg = '身份验证失败，请检查用户名 and 密码。';
        }

        // Update database if it's an existing environment
        if (testId) {
            await pool.query(
                'UPDATE environments SET last_test_status = ?, last_test_message = ?, last_test_at = NOW() WHERE id = ?',
                ['error', errorMsg, testId]
            );
        }

        return NextResponse.json({ error: errorMsg }, { status: 500 });
    } finally {
        ssh.disconnect();
    }
}
