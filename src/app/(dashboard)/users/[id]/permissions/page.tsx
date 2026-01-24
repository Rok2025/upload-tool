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
                                    <label className="checkbox-wrapper">
                                        <input
                                            type="checkbox"
                                            checked={selectedProjects.has(project.id)}
                                            onChange={() => toggleProject(project.id)}
                                            className="checkbox"
                                        />
                                        <span className="checkmark"></span>
                                    </label>
                                </td>
                            </tr>
                        ))}
                        {projects.length === 0 && (
                            <tr>
                                <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '48px' }}>
                                    暂无项目
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <style jsx>{`
                .permissions-page { }
                .page-header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center; 
                    margin-bottom: 24px; 
                }
                .page-header h1 { 
                    font-size: 24px; 
                    margin: 0; 
                    color: var(--text-primary);
                }
                .actions { 
                    display: flex; 
                    gap: 12px; 
                }
                .loading { 
                    text-align: center; 
                    padding: 48px; 
                    color: var(--text-muted); 
                }
                
                .card { 
                    background: var(--bg-card); 
                    backdrop-filter: var(--backdrop-blur);
                    border-radius: 16px; 
                    overflow: hidden; 
                    box-shadow: var(--shadow-glow);
                    border: 1px solid var(--border-subtle);
                }
                .permission-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                }
                .permission-table th, .permission-table td { 
                    padding: 16px; 
                    text-align: left; 
                    border-bottom: 1px solid var(--border-subtle); 
                }
                .permission-table th { 
                    background: var(--bg-secondary); 
                    font-weight: 600; 
                    color: var(--text-secondary); 
                    font-size: 13px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                [data-theme="dark"] .permission-table th {
                    background: rgba(30, 41, 59, 0.5);
                }
                .permission-table td { 
                    font-size: 14px; 
                    color: var(--text-primary);
                }
                .permission-table td strong {
                    color: var(--text-primary);
                }
                .permission-table tr:hover td {
                    background: rgba(99, 102, 241, 0.05);
                }
                
                .checkbox-wrapper {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    cursor: pointer;
                }
                .checkbox { 
                    position: absolute;
                    opacity: 0;
                    cursor: pointer;
                    height: 0;
                    width: 0;
                }
                .checkmark {
                    width: 20px;
                    height: 20px;
                    border: 2px solid var(--border-subtle);
                    border-radius: 4px;
                    background: var(--bg-input);
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .checkbox-wrapper:hover .checkmark {
                    border-color: var(--accent-primary);
                }
                .checkbox:checked + .checkmark {
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
                    border-color: var(--accent-primary);
                    box-shadow: 0 0 12px rgba(99, 102, 241, 0.4);
                }
                .checkbox:checked + .checkmark::after {
                    content: '';
                    width: 6px;
                    height: 10px;
                    border: solid white;
                    border-width: 0 2px 2px 0;
                    transform: rotate(45deg);
                    margin-bottom: 2px;
                }
                
                .btn-primary { 
                    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); 
                    color: #fff; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 8px; 
                    font-weight: 600; 
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                }
                .btn-primary::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s;
                }
                .btn-primary:hover::after {
                    left: 100%;
                }
                .btn-primary:hover {
                    box-shadow: var(--shadow-glow);
                    transform: translateY(-1px);
                }
                .btn-secondary { 
                    background: var(--bg-input); 
                    color: var(--text-secondary); 
                    border: 1px solid var(--border-subtle); 
                    padding: 10px 20px; 
                    border-radius: 8px; 
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-secondary:hover {
                    background: rgba(51, 65, 85, 0.8);
                    border-color: var(--accent-primary);
                    color: var(--text-primary);
                }
            `}</style>
        </div>
    );
}
