'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Project {
    id: number;
    name: string;
    description: string | null;
}

interface Permission {
    id: number;
    project_id: number;
    project_name: string;
    permission_type: 'deploy' | 'view';
}

export default function UserPermissionsPage() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id;

    const [projects, setProjects] = useState<Project[]>([]);
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProjects, setSelectedProjects] = useState<Set<number>>(new Set());

    const fetchData = async () => {
        setLoading(true);
        const [projRes, permRes] = await Promise.all([
            fetch('/api/projects'),
            fetch(`/api/permissions?userId=${userId}`)
        ]);

        if (projRes.ok) setProjects(await projRes.json());
        if (permRes.ok) {
            const perms = await permRes.json();
            setPermissions(perms);
            // 初始化已选中的项目
            const deployPerms = perms.filter((p: Permission) => p.permission_type === 'deploy');
            const selected = new Set<number>(deployPerms.map((p: Permission) => p.project_id));
            setSelectedProjects(selected);
        }
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, [userId]);

    const toggleProject = (projectId: number) => {
        const newSelected = new Set(selectedProjects);
        if (newSelected.has(projectId)) {
            newSelected.delete(projectId);
        } else {
            newSelected.add(projectId);
        }
        setSelectedProjects(newSelected);
    };

    const handleSave = async () => {
        try {
            // 1. 删除所有现有权限
            for (const perm of permissions) {
                await fetch(`/api/permissions?id=${perm.id}`, { method: 'DELETE' });
            }

            // 2. 添加新选中的权限
            for (const projectId of selectedProjects) {
                await fetch('/api/permissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: parseInt(userId as string),
                        projectId,
                        permissionType: 'deploy'
                    })
                });
            }

            alert('权限保存成功');
            router.push('/users');
        } catch (error) {
            alert('保存失败：' + error);
        }
    };

    if (loading) return <div className="loading">加载中...</div>;

    return (
        <div className="permissions-page">
            <div className="page-header">
                <h1>项目权限配置</h1>
                <div className="actions">
                    <button type="button" className="btn-secondary" onClick={() => router.push('/users')}>
                        返回
                    </button>
                    <button type="button" className="btn-primary" onClick={handleSave}>
                        保存
                    </button>
                </div>
            </div>

            <div className="card">
                <table className="permission-table">
                    <thead>
                        <tr>
                            <th>项目名称</th>
                            <th>描述</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>部署权限</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projects.map((project) => (
                            <tr key={project.id}>
                                <td><strong>{project.name}</strong></td>
                                <td>{project.description || '-'}</td>
                                <td style={{ textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedProjects.has(project.id)}
                                        onChange={() => toggleProject(project.id)}
                                        className="checkbox"
                                    />
                                </td>
                            </tr>
                        ))}
                        {projects.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', color: '#94a3b8', padding: '48px' }}>
                                    暂无项目
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .permissions-page { }
                .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .page-header h1 { font-size: 24px; margin: 0; }
                .actions { display: flex; gap: 12px; }
                .loading { text-align: center; padding: 48px; color: #64748b; }
                
                .card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .permission-table { width: 100%; border-collapse: collapse; }
                .permission-table th, .permission-table td { padding: 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }
                .permission-table th { background: #f8fafc; font-weight: 600; color: #475569; font-size: 13px; }
                .permission-table td { font-size: 14px; }
                
                .checkbox { width: 18px; height: 18px; cursor: pointer; }
                
                .btn-primary { background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
                .btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
            `}</style>
        </div>
    );
}
