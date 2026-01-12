import pool from '../db';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

async function migrate() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log('开始数据库迁移: 在 projects 表中添加 base_path...');

        // 1. 检查并添加 base_path 列
        const [column]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'base_path'
        `);

        if (column.length === 0) {
            await connection.query(`
                ALTER TABLE projects 
                ADD COLUMN base_path VARCHAR(512) DEFAULT ''
            `);
            console.log('  ✓ base_path 列添加成功');
        } else {
            console.log('  ⚠ base_path 列已存在');
        }

        await connection.commit();
        console.log('✅ 数据库迁移成功！');
    } catch (error) {
        await connection.rollback();
        console.error('❌ 数据库迁移失败:', error);
        process.exit(1);
    } finally {
        connection.release();
        process.exit(0);
    }
}

migrate();
