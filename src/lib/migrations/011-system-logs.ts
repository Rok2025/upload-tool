import pool from '../db';

export async function up() {
    console.log('Running migration: 011-system-logs...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS system_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            level ENUM('info', 'warn', 'error') NOT NULL DEFAULT 'info',
            category VARCHAR(50) NOT NULL COMMENT 'ssh, auth, deploy, config, system',
            action VARCHAR(100) NOT NULL COMMENT 'connect, test-connection, login, etc.',
            message TEXT NOT NULL,
            detail TEXT DEFAULT NULL COMMENT 'Stack trace or extra detail',
            target_host VARCHAR(100) DEFAULT NULL,
            user_id INT DEFAULT NULL,
            username VARCHAR(50) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (level),
            INDEX idx_category (category),
            INDEX idx_created_at (created_at),
            INDEX idx_target_host (target_host)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('Migration 011-system-logs completed.');
}

export async function down() {
    await pool.query('DROP TABLE IF EXISTS system_logs;');
}
