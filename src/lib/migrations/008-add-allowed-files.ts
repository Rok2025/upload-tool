import pool from '../db';

export async function up() {
    try {
        await pool.query(`
            ALTER TABLE modules 
            ADD COLUMN allowed_files VARCHAR(255) DEFAULT NULL COMMENT 'Comma separated list of allowed file extensions (e.g. .jar,.zip)'
        `);
        console.log('Migration 008-add-allowed-files applied successfully');
    } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('Column allowed_files already exists, skipping');
        } else {
            console.error('Migration failed:', error);
            throw error;
        }
    }
}

export async function down() {
    await pool.query('ALTER TABLE modules DROP COLUMN allowed_files');
}
