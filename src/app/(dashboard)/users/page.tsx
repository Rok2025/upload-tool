'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface User {
    id: number;
    username: string;
    email: string | null;
    role: 'admin' | 'developer' | 'viewer';
    status: 'active' | 'disabled';
    created_at: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<User | null>(null);

    const [formData, setFormData] = useState<{
        username: string;
        email: string;
        password: string;
        role: 'admin' | 'developer' | 'viewer';
        status: 'active' | 'disabled';
    }>({
        username: '',
        email: '',
        password: '',
        role: 'developer',
        status: 'active'
    });

    const fetchUsers = async () => {
        setLoading(true);
        const res = await fetch('/api/users');
        if (res.ok) {
            setUsers(await res.json());
        }
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

    const resetForm = () => {
        setFormData({
            username: '',
            email: '',
            password: '',
            role: 'developer',
            status: 'active'
        });
        setEditingUser(null);
    };

    const openAddModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            email: user.email || '',
            password: '',
            role: user.role,
            status: user.status
        });
        setShowModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const method = editingUser ? 'PUT' : 'POST';
        const body = editingUser
            ? { id: editingUser.id, ...formData }
            : formData;

        const res = await fetch('/api/users', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (res.ok) {
            setShowModal(false);
            resetForm();
            fetchUsers();
        } else {
            const error = await res.json();
            alert(error.error || '操作失败');
        }
    };

    const handleDelete = async () => {
        if (!deleteConfirm) return;

        await fetch(`/api/users?id=${deleteConfirm.id}`, { method: 'DELETE' });
        setDeleteConfirm(null);
        fetchUsers();
    };

    if (loading) return <div className="loading">加载中...</div>;

    return (
        <div className="users-page">
            <div className="page-header">
                <h1>用户管理</h1>
                <button type="button" className="btn-primary" onClick={openAddModal}>
                    + 新增用户
                </button>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>用户名</th>
                            <th>邮箱</th>
                            <th>角色</th>
                            <th>状态</th>
                            <th>创建时间</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td><strong>{user.username}</strong></td>
                                <td>{user.email || '-'}</td>
                                <td>
                                    <span className={`role-badge ${user.role}`}>
                                        {user.role === 'admin' ? '管理员' : user.role === 'developer' ? '开发者' : '查看者'}
                                    </span>
                                </td>
                                <td>
                                    <span className={`status-badge ${user.status}`}>
                                        {user.status === 'active' ? '启用' : '禁用'}
                                    </span>
                                </td>
                                <td>{new Date(user.created_at).toLocaleDateString('zh-CN')}</td>
                                <td>
                                    <Link href={`/users/${user.id}/permissions`} className="text-btn">
                                        权限
                                    </Link>
                                    <button type="button" className="text-btn" onClick={() => openEditModal(user)}>
                                        编辑
                                    </button>
                                    {user.role !== 'admin' && (
                                        <button type="button" className="text-btn danger" onClick={() => setDeleteConfirm(user)}>
                                            删除
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{editingUser ? '编辑用户' : '新增用户'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>用户名</label>
                                <input
                                    required
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="请输入用户名"
                                />
                            </div>
                            <div className="form-group">
                                <label>邮箱</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="可选"
                                />
                            </div>
                            <div className="form-group">
                                <label>密码 {editingUser && <span className="hint">(留空表示不修改)</span>}</label>
                                <input
                                    type="password"
                                    required={!editingUser}
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    placeholder={editingUser ? '不修改请留空' : '请输入密码'}
                                />
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label>角色</label>
                                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'developer' | 'viewer' })}>
                                        <option value="admin">管理员</option>
                                        <option value="developer">开发者</option>
                                        <option value="viewer">查看者</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>状态</label>
                                    <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'disabled' })}>
                                        <option value="active">启用</option>
                                        <option value="disabled">禁用</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                                    取消
                                </button>
                                <button type="submit" className="btn-primary">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirm */}
            {deleteConfirm && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
                    <div className="modal-content small" onClick={e => e.stopPropagation()}>
                        <h3>确认删除</h3>
                        <p>确定要删除用户 <strong>{deleteConfirm.username}</strong> 吗？此操作不可撤销。</p>
                        <div className="modal-actions">
                            <button type="button" className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
                                取消
                            </button>
                            <button type="button" className="btn-danger" onClick={handleDelete}>删除</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .users-page { }
                .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .page-header h1 { font-size: 24px; margin: 0; }
                .loading { text-align: center; padding: 48px; color: #64748b; }
                
                .card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .data-table { width: 100%; border-collapse: collapse; }
                .data-table th, .data-table td { padding: 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }
                .data-table th { background: #f8fafc; font-weight: 600; color: #475569; font-size: 13px; }
                .data-table td { font-size: 14px; }
                
                .role-badge, .status-badge { padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; }
                .role-badge.admin { background: #fef3c7; color: #92400e; }
                .role-badge.developer { background: #dbeafe; color: #1e40af; }
                .role-badge.viewer { background: #e0e7ff; color: #3730a3; }
                .status-badge.active { background: #d1fae5; color: #065f46; }
                .status-badge.disabled { background: #fee2e2; color: #991b1b; }
                
                .text-btn { color: #2563eb; background: none; border: none; cursor: pointer; font-size: 13px; margin-right: 12px; }
                .text-btn.danger { color: #ef4444; }
                
                .btn-primary { background: #2563eb; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
                .btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
                .btn-danger { background: #ef4444; color: #fff; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
                
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
                .modal-content { background: #fff; padding: 32px; border-radius: 12px; width: 100%; max-width: 500px; }
                .modal-content.small { max-width: 400px; }
                .modal-content h3 { margin-bottom: 24px; font-size: 20px; }
                .modal-content p { color: #64748b; margin-bottom: 24px; }
                .form-group { margin-bottom: 20px; }
                .form-group label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #475569; }
                .form-group .hint { font-weight: normal; color: #94a3b8; font-size: 12px; }
                .form-group input, .form-group select { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
                .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; }
            `}</style>
        </div>
    );
}
