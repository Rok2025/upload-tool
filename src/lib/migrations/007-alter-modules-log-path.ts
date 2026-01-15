import pool from '../db';

/**
 * Update modules table: change log_path to TEXT to support JSON arrays
 */
async function migrate() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log('เริ่มการย้ายฐานข้อมูล: ปรับปรุงตาราง modules...');

        // Check current column type (optional, but good for safety)
        // For simplicity, we will just execute the ALTER command to TEXT.
        // This preserves existing data.

        await connection.query(`
            ALTER TABLE modules 
            MODIFY COLUMN log_path TEXT
        `);
        console.log('  ✓ Modified log_path to TEXT');

        await connection.commit();
        console.log('✅ Database migration successful!');
    } catch (error) {
        await connection.rollback();
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        connection.release();
        process.exit(0);
    }
}

migrate();
