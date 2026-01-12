const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars from root .env.local
dotenv.config({ path: path.join(__dirname, '../../../.env.local') });

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.MYSQL_HOST || 'localhost',
        user: process.env.MYSQL_USER || 'root',
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE || 'upload_tool',
        port: parseInt(process.env.MYSQL_PORT || '5836'),
    });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log('开始数据库迁移: 为 modules 和 module_env_configs 添加 restart_command 列...');

        // 1. 给 modules 表添加 restart_command
        const [modulesCols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'modules' AND COLUMN_NAME = 'restart_command'
        `, [process.env.MYSQL_DATABASE || 'upload_tool']);

        if (modulesCols.length === 0) {
            await connection.query(`ALTER TABLE modules ADD COLUMN restart_command TEXT AFTER stop_command`);
            console.log('  ✓ modules 表 restart_command 列添加成功');
        } else {
            console.log('  - modules 表 restart_command 列已存在');
        }

        // 2. 给 module_env_configs 表添加 restart_command
        const [configCols] = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'module_env_configs' AND COLUMN_NAME = 'restart_command'
        `, [process.env.MYSQL_DATABASE || 'upload_tool']);

        if (configCols.length === 0) {
            await connection.query(`ALTER TABLE module_env_configs ADD COLUMN restart_command TEXT AFTER stop_command`);
            console.log('  ✓ module_env_configs 表 restart_command 列添加成功');
        } else {
            console.log('  - module_env_configs 表 restart_command 列已存在');
        }

        await connection.commit();
        console.log('✅ 数据库迁移成功！');
    } catch (error) {
        await connection.rollback();
        console.error('❌ 数据库迁移失败:', error);
        process.exit(1);
    } finally {
        connection.release();
        await pool.end();
        process.exit(0);
    }
}

migrate();
