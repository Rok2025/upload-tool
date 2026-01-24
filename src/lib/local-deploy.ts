import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class LocalDeploymentService {
    async connect(config: any): Promise<void> {
        // No connection needed for local
        return Promise.resolve();
    }

    async exec(command: string): Promise<{ stdout: string; stderr: string }> {
        try {
            // Execute command in shell with a default timeout of 30 seconds
            // This prevents the request from hanging if a command (like startup) blocks
            const { stdout, stderr } = await execAsync(command, {
                timeout: 30000,
                maxBuffer: 1024 * 1024 * 10 // 10MB buffer for verbose logs
            });
            return { stdout, stderr };
        } catch (error: any) {
            // Check if it was a timeout
            if (error.code === 'ETIMEDOUT' || error.killed) {
                console.warn(`[LocalDeploy] Command timed out (30s): ${command}`);
                // For restart commands, a timeout might logically mean it started running successfully but didn't detach.
                // We'll return partial output or a warning.
                return {
                    stdout: error.stdout || '',
                    stderr: error.stderr || 'Command timed out (but likely started). Please verify.'
                };
            }

            // child_process.exec throws on non-zero exit code
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message
            };
        }
    }

    async putFile(localPath: string, remotePath: string): Promise<void> {
        // Ensure destination directory exists
        const destDir = path.dirname(remotePath);
        await fs.mkdir(destDir, { recursive: true });

        // Copy file
        await fs.copyFile(localPath, remotePath);
    }

    /**
     * For local logs, we can use 'tail -f' via spawn if on Linux/Mac,
     * or just simple polling/reading.
     * Since the interface expects a stream-like behavior...
     * Actually route.ts doesn't use tailStream, only runtime-logs page might.
     * But route.ts DOES NOT use tailStream. route.ts uses exec and putFile.
     * If we need to support tailStream closer to SSHService, we can add it later.
     * For now, route.ts is the consumer.
     */
    async tailStream(remotePath: string, onData: (data: string) => void): Promise<any> {
        // Simple implementation using tail -f for local files
        const { spawn } = await import('child_process');
        const tail = spawn('tail', ['-f', '-n', '100', remotePath]);

        tail.stdout.on('data', (data) => onData(data.toString()));
        tail.stderr.on('data', (data) => onData(data.toString()));

        return tail;
    }

    disconnect() {
        // Nothing to disconnect
    }
}
