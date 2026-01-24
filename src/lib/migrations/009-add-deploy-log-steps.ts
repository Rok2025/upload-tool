import pool from '../db';

export async function up() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS deploy_log_steps (
                id INT AUTO_INCREMENT PRIMARY KEY,
                deploy_log_id INT NOT NULL,
                step_key VARCHAR(64) NOT NULL,
                section ENUM('local', 'remote') NOT NULL,
                status ENUM('pending', 'running', 'success', 'failed') NOT NULL DEFAULT 'pending',
                message VARCHAR(255) NOT NULL,
                order_index INT NOT NULL,
                started_at TIMESTAMP NULL,
                finished_at TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY uniq_deploy_step (deploy_log_id, step_key),
                INDEX idx_deploy_log (deploy_log_id),
                FOREIGN KEY (deploy_log_id) REFERENCES deploy_logs(id) ON DELETE CASCADE
            )
        `);
        console.log('Migration 009-add-deploy-log-steps applied successfully');
    } catch (error: any) {
        // CREATE TABLE IF NOT EXISTS should be safe; still keep explicit logging.
        console.error('Migration failed:', error);
        throw error;
    }
}

export async function down() {
    await pool.query('DROP TABLE IF EXISTS deploy_log_steps');
}
