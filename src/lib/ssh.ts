import { Client, ClientChannel } from 'ssh2';
import path from 'path';

export interface SSHConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
}

export class SSHService {
    private client: Client;

    constructor() {
        this.client = new Client();
    }

    async connect(config: SSHConfig): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client
                .on('ready', resolve)
                .on('error', reject)
                .connect({
                    ...config,
                    readyTimeout: 10000 // 10 seconds timeout for handshake
                });
        });
    }

    async exec(command: string): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            this.client.exec(command, (err, stream) => {
                if (err) return reject(err);
                let stdout = '';
                let stderr = '';
                stream
                    .on('close', () => resolve({ stdout, stderr }))
                    .on('data', (data: any) => (stdout += data.toString()))
                    .stderr.on('data', (data: any) => (stderr += data.toString()));
            });
        });
    }

    async putFile(localPath: string, remotePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.sftp((err, sftp) => {
                if (err) return reject(err);
                sftp.fastPut(localPath, remotePath, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async tailStream(remotePath: string, onData: (data: string) => void): Promise<ClientChannel> {
        return new Promise((resolve, reject) => {
            // Use Powershell on Windows Hub, but here we target Linux since B nodes are Linux
            const command = `tail -f -n 100 ${remotePath}`;
            this.client.exec(command, (err, stream) => {
                if (err) return reject(err);
                stream.on('data', (data: any) => onData(data.toString()));
                resolve(stream);
            });
        });
    }

    disconnect() {
        this.client.end();
    }
}
