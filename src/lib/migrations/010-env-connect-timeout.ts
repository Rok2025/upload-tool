import pool from '../db';

export async function up() {
    console.log('Running migration: 010-env-connect-timeout...');

    await pool.query(`
        ALTER TABLE environments
        ADD COLUMN connect_timeout INT DEFAULT 20 COMMENT 'SSH connection timeout in seconds';
    `);

    console.log('Migration 010-env-connect-timeout completed.');
}

export async function down() {
    await pool.query(`
        ALTER TABLE environments
        DROP COLUMN connect_timeout;
    `);
}
