import pool from './db';

export type LogLevel = 'info' | 'warn' | 'error';
export type LogCategory = 'ssh' | 'auth' | 'deploy' | 'config' | 'system';

interface SystemLogEntry {
    level: LogLevel;
    category: LogCategory;
    action: string;
    message: string;
    detail?: string;
    targetHost?: string;
    userId?: number;
    username?: string;
}

/**
 * Write a system log entry to the database.
 * This function is fire-and-forget — it never throws.
 */
export async function syslog(entry: SystemLogEntry): Promise<void> {
    try {
        await pool.query(
            `INSERT INTO system_logs (level, category, action, message, detail, target_host, user_id, username)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                entry.level,
                entry.category,
                entry.action,
                entry.message,
                entry.detail || null,
                entry.targetHost || null,
                entry.userId || null,
                entry.username || null,
            ]
        );
    } catch (err) {
        // Logging should never crash the app — fallback to console
        console.error('[syslog] Failed to write system log:', err, entry);
    }
}

/** Convenience helpers */
export const syslogInfo = (category: LogCategory, action: string, message: string, extra?: Partial<SystemLogEntry>) =>
    syslog({ level: 'info', category, action, message, ...extra });

export const syslogWarn = (category: LogCategory, action: string, message: string, extra?: Partial<SystemLogEntry>) =>
    syslog({ level: 'warn', category, action, message, ...extra });

export const syslogError = (category: LogCategory, action: string, message: string, extra?: Partial<SystemLogEntry>) =>
    syslog({ level: 'error', category, action, message, ...extra });
