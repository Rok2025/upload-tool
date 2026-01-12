import pool from '../db';
import dotenv from 'dotenv';

// Load env vars
dotenv.config({ path: '.env.local' });

async function migrate() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log('开始数据库迁移: 在 projects 表中添加 environment_id...');

        // 1. 检查并添加 environment_id 列
        const [column]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects' AND COLUMN_NAME = 'environment_id'
        `);

        if (column.length === 0) {
            await connection.query(`
                ALTER TABLE projects 
                ADD COLUMN environment_id INT,
                ADD CONSTRAINT fk_project_environment FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE SET NULL
            `);
            console.log('  ✓ environment_id 列添加成功');
        } else {
            console.log('  ⚠ environment_id 列已存在');
        }

        // 2. (可选) 如果之前有迁移数据，可以尝试初始化
        // 这里不做复杂逻辑，留给用户在 UI 中手动绑定

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
