import pool from './db';
import bcrypt from 'bcryptjs';

async function init() {
    try {
        console.log('Starting database initialization...');

        // 1. Hash a default password
        const adminPassword = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(adminPassword, salt);

        // 2. Clear old admin if necessary or use ON DUPLICATE KEY UPDATE
        // We'll use ON DUPLICATE KEY UPDATE to ensure password is reset
        await pool.query(`
            INSERT INTO users (username, password_hash, role) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = VALUES(role)
        `, ['admin', hash, 'admin']);

        console.log('Default admin user created or reset: admin / admin123');
        console.log('Initialization complete.');
        process.exit(0);
    } catch (err) {
        console.error('Initialization failed:', err);
        process.exit(1);
    }
}

init();
