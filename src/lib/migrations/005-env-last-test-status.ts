import pool from '../db';

export async function up() {
    console.log('Running migration: 005-env-last-test-status...');

    // Add status and status_message columns to environments
    await pool.query(`
        ALTER TABLE environments 
        ADD COLUMN last_test_status ENUM('success', 'error') DEFAULT NULL,
        ADD COLUMN last_test_message TEXT DEFAULT NULL,
        ADD COLUMN last_test_at DATETIME DEFAULT NULL;
    `);

    console.log('Migration 005-env-last-test-status completed.');
}

export async function down() {
    await pool.query(`
        ALTER TABLE environments 
        DROP COLUMN last_test_status,
        DROP COLUMN last_test_message,
        DROP COLUMN last_test_at;
    `);
}
