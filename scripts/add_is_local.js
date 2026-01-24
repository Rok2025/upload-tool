
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function migrate() {
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST || 'localhost',
        port: Number(process.env.MYSQL_PORT) || 5836,
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'upload_tool',
    });

    try {
        console.log('Adding is_local column...');
        await connection.query('ALTER TABLE environments ADD COLUMN is_local BOOLEAN DEFAULT FALSE');
        console.log('Column added successfully.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
            console.log('Column already exists.');
        } else {
            console.error('Error adding column:', e);
        }
    } finally {
        await connection.end();
    }
}

migrate();
