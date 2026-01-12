import pool from '../db';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

async function migrate() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log('开始数据库迁移: 为 modules 和 module_env_configs 添加 restart_command 列...');

        // 1. 给 modules 表添加 restart_command
        await connection.query(`
            ALTER TABLE modules 
            ADD COLUMN IF NOT EXISTS restart_command TEXT AFTER stop_command;
        `);
        console.log('  ✓ modules 表 restart_command 列添加成功');

        // 2. 给 module_env_configs 表添加 restart_command
        await connection.query(`
            ALTER TABLE module_env_configs 
            ADD COLUMN IF NOT EXISTS restart_command TEXT AFTER stop_command;
        `);
        console.log('  ✓ module_env_configs 表 restart_command 列添加成功');

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
