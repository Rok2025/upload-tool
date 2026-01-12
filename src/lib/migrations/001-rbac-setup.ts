import pool from '../db';

/**
 * 数据库迁移：添加用户管理和权限系统
 * 1. 扩展 users 表 - 添加 email, status, created_at, updated_at
 * 2. 创建 user_project_permissions 表 - 用户-项目权限映射
 */
async function migrate() {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();
        console.log('开始数据库迁移...');

        // 1. 扩展 users 表
        console.log('1. 扩展 users 表...');

        // 检查并添加 email 列
        const [emailCol]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email'
        `);
        if (emailCol.length === 0) {
            await connection.query('ALTER TABLE users ADD COLUMN email VARCHAR(255) UNIQUE');
            console.log('  ✓ 添加 email 列');
        }

        // 检查并添加 status 列
        const [statusCol]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'status'
        `);
        if (statusCol.length === 0) {
            await connection.query(`ALTER TABLE users ADD COLUMN status ENUM('active', 'disabled') DEFAULT 'active'`);
            console.log('  ✓ 添加 status 列');
        }

        // 检查并添加 created_at 列
        const [createdCol]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'created_at'
        `);
        if (createdCol.length === 0) {
            await connection.query('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
            console.log('  ✓ 添加 created_at 列');
        }

        // 检查并添加 updated_at 列
        const [updatedCol]: any = await connection.query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'updated_at'
        `);
        if (updatedCol.length === 0) {
            await connection.query('ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
            console.log('  ✓ 添加 updated_at 列');
        }

        // 2. 创建用户-项目权限表
        console.log('2. 创建 user_project_permissions 表...');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS user_project_permissions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                project_id INT NOT NULL,
                permission_type ENUM('deploy', 'view') DEFAULT 'view',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                UNIQUE KEY unique_permission (user_id, project_id),
                INDEX idx_user (user_id),
                INDEX idx_project (project_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 3. 为现有 admin 用户设置 email（如果没有）
        console.log('3. 更新 admin 用户信息...');
        await connection.query(`
            UPDATE users 
            SET email = 'admin@example.com', status = 'active'
            WHERE username = 'admin' AND email IS NULL
        `);

        await connection.commit();
        console.log('✅ 数据库迁移成功！');
        console.log('');
        console.log('已创建/更新：');
        console.log('  - users 表（新增字段：email, status, created_at, updated_at）');
        console.log('  - user_project_permissions 表（用户-项目权限映射）');

    } catch (error) {
        await connection.rollback();
        console.error('❌ 迁移失败:', error);
        throw error;
    } finally {
        connection.release();
        await pool.end();
    }
}

// 执行迁移
migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
