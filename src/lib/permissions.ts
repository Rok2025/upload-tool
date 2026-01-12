import { NextRequest } from 'next/server';
import pool from './db';
import { getSession, UserSession } from './auth';

/**
 * 检查用户是否有部署某项目的权限
 * @param userId 用户 ID
 * @param projectId 项目 ID
 * @returns true 如果有权限，false 否则
 */
export async function checkDeployPermission(
    userId: number,
    projectId: number
): Promise<boolean> {
    try {
        // 1. 检查用户角色（admin 拥有所有权限）
        const [userRows]: any = await pool.query(
            'SELECT role FROM users WHERE id = ?',
            [userId]
        );

        if (!userRows.length) return false;
        if (userRows[0].role === 'admin') return true;

        // 2. 检查项目级权限
        const [permRows]: any = await pool.query(
            `SELECT id FROM user_project_permissions 
             WHERE user_id = ? AND project_id = ? AND permission_type = 'deploy'`,
            [userId, projectId]
        );

        return permRows.length > 0;
    } catch (error) {
        console.error('权限检查失败:', error);
        return false;
    }
}

/**
 * 检查用户是否可以查看某项目
 * @param userId 用户 ID
 * @param projectId 项目 ID
 * @returns true 如果有权限，false 否则
 */
export async function checkViewPermission(
    userId: number,
    projectId: number
): Promise<boolean> {
    try {
        const [userRows]: any = await pool.query(
            'SELECT role FROM users WHERE id = ?',
            [userId]
        );

        if (!userRows.length) return false;
        if (userRows[0].role === 'admin') return true;

        // 有 deploy 或 view 权限都可以查看
        const [permRows]: any = await pool.query(
            `SELECT id FROM user_project_permissions 
             WHERE user_id = ? AND project_id = ?`,
            [userId, projectId]
        );

        return permRows.length > 0;
    } catch (error) {
        console.error('权限检查失败:', error);
        return false;
    }
}

/**
 * 在 API 中要求部署权限，如果没有权限则返回 null
 * @param req NextRequest 对象
 * @param projectId 项目 ID
 * @returns UserSession 如果有权限，null 否则
 */
export async function requireDeployPermission(
    req: NextRequest,
    projectId: number
): Promise<UserSession | null> {
    const user = await getSession();
    if (!user) return null;

    const hasPermission = await checkDeployPermission(user.id, projectId);
    return hasPermission ? user : null;
}

/**
 * 获取用户有权限的所有项目 ID 列表
 * @param userId 用户 ID
 * @param permissionType 权限类型 ('deploy' | 'view' | 'all')
 * @returns 项目 ID 数组
 */
export async function getUserProjectIds(
    userId: number,
    permissionType: 'deploy' | 'view' | 'all' = 'all'
): Promise<number[]> {
    try {
        const [userRows]: any = await pool.query(
            'SELECT role FROM users WHERE id = ?',
            [userId]
        );

        if (!userRows.length) return [];

        // admin 可以访问所有项目
        if (userRows[0].role === 'admin') {
            const [projectRows]: any = await pool.query('SELECT id FROM projects');
            return projectRows.map((row: any) => row.id);
        }

        // 根据权限类型查询
        let query = `SELECT DISTINCT project_id FROM user_project_permissions WHERE user_id = ?`;
        const params: any[] = [userId];

        if (permissionType !== 'all') {
            query += ` AND permission_type = ?`;
            params.push(permissionType);
        }

        const [permRows]: any = await pool.query(query, params);
        return permRows.map((row: any) => row.project_id);
    } catch (error) {
        console.error('获取用户项目列表失败:', error);
        return [];
    }
}
