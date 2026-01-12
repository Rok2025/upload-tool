import pool from '../db';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: '.env.local' });

async function migrate() {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        console.log('开始数据库迁移: 创建 module_env_configs 表...');

        // 1. 创建模块-环境特定配置表
        await connection.query(`
            CREATE TABLE IF NOT EXISTS module_env_configs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                module_id INT NOT NULL,
                environment_id INT NOT NULL,
                remote_path VARCHAR(512) NOT NULL,
                start_command TEXT,
                stop_command TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_module_env (module_id, environment_id),
                FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE,
                FOREIGN KEY (environment_id) REFERENCES environments(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        console.log('  ✓ module_env_configs 表创建成功');

        // 2. 将现有 modules 表中的配置迁移到默认环境下 (假设第一个环境是默认环境)
        // 这是一个可选的平滑迁移步骤，如果数据库已经有数据的话
        const [envs]: any = await connection.query('SELECT id FROM environments LIMIT 1');
        if (envs.length > 0) {
            const defaultEnvId = envs[0].id;
            console.log(`2. 迁移现有模块数据到环境 ID: ${defaultEnvId}...`);

            await connection.query(`
                INSERT IGNORE INTO module_env_configs (module_id, environment_id, remote_path, start_command, stop_command)
                SELECT id, ?, remote_path, start_command, stop_command FROM modules
            `, [defaultEnvId]);
            console.log('  ✓ 现有数据迁移完成');
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
