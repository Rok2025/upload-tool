'use client';

import { useState, useEffect, useMemo } from 'react';

export default function DeployPage() {
    const [projects, setProjects] = useState<any[]>([]);
    const [environments, setEnvironments] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Deployment state per module
    const [deployStates, setDeployStates] = useState<Record<number, {
        status: string;
        progress: number;
        file: File | null;
        isUploading: boolean;
        skipRestart: boolean;
    }>>({});

    useEffect(() => {
        const loadData = async () => {
            const [projRes, envRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/environments')
            ]);
            const projData = await projRes.json();
            const envData = await envRes.json();
            setProjects(projData);
            setEnvironments(envData);

            // Auto-select first project if available
            if (projData.length > 0) {
                setSelectedProjectId(projData[0].id);
            }
        };
        loadData();
    }, []);

    const filteredProjects = useMemo(() => {
        return projects.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [projects, searchQuery]);

    const selectedProject = useMemo(() => {
        return projects.find(p => p.id === selectedProjectId);
    }, [projects, selectedProjectId]);

    const updateModuleState = (moduleId: number, updates: any) => {
        setDeployStates(prev => ({
            ...prev,
            [moduleId]: { ...(prev[moduleId] || { status: '', progress: 0, file: null, isUploading: false, skipRestart: false }), ...updates }
        }));
    };

    const handleUpload = async (moduleId: number) => {
        const state = deployStates[moduleId];
        if (!state?.file) return;

        updateModuleState(moduleId, { isUploading: true, status: '正在上传...', progress: 0 });

        try {
            const file = state.file;
            const chunkSize = 5 * 1024 * 1024; // 5MB
            const totalChunks = Math.ceil(file.size / chunkSize);
            const fileHash = file.name + '-' + file.size;

            for (let i = 0; i < totalChunks; i++) {
                const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
                const formData = new FormData();
                formData.append('chunk', chunk);
                formData.append('chunkIndex', i.toString());
                formData.append('totalChunks', totalChunks.toString());
                formData.append('fileName', file.name);
                formData.append('fileHash', fileHash);

                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error('上传分片失败');

                updateModuleState(moduleId, { progress: Math.round(((i + 1) / totalChunks) * 100) });
            }

            updateModuleState(moduleId, { status: '上传完成，正在启动分发部署...' });

            const deployRes = await fetch('/api/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moduleId: moduleId,
                    environmentId: selectedProject?.environment_id,
                    fileName: file.name,
                    skipRestart: state.skipRestart
                })
            });

            if (deployRes.ok) {
                updateModuleState(moduleId, { status: '部署成功！', isUploading: false });
                // Reset file after success
                setTimeout(() => updateModuleState(moduleId, { status: '', progress: 0, file: null }), 3000);
            } else {
                const errorData = await deployRes.json().catch(() => ({}));
                updateModuleState(moduleId, { status: `错误: ${errorData.error || '部署失败'}`, isUploading: false });
            }
        } catch (error: any) {
            updateModuleState(moduleId, { status: `异常: ${error.message}`, isUploading: false });
        }
    };

    const handleManualRestart = async (moduleId: number) => {
        updateModuleState(moduleId, { isUploading: true, status: '正在尝试重启服务...' });
        try {
            const res = await fetch('/api/deploy/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moduleId: moduleId,
                    environmentId: selectedProject?.environment_id
                })
            });

            if (res.ok) {
                updateModuleState(moduleId, { status: '服务重启成功！', isUploading: false });
                setTimeout(() => updateModuleState(moduleId, { status: '', progress: 0 }), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                updateModuleState(moduleId, { status: `重启失败: ${data.error || '未知错误'}`, isUploading: false });
            }
        } catch (error: any) {
            updateModuleState(moduleId, { status: `操作异常: ${error.message}`, isUploading: false });
        }
    };

    return (
        <div className="deploy-layout">
            {/* Left Sidebar: Project List */}
            <aside className="project-sidebar">
                <div className="sidebar-header">
                    <h3>项目列表</h3>
                    <div className="search-box">
                        <input
                            type="text"
                            placeholder="搜索项目..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                <div className="sidebar-content">
                    {filteredProjects.map(p => (
                        <div
                            key={p.id}
                            className={`project-item ${selectedProjectId === p.id ? 'active' : ''}`}
                            onClick={() => setSelectedProjectId(p.id)}
                        >
                            <div className="project-icon">📦</div>
                            <div className="project-info">
                                <div className="name">{p.name}</div>
                                <div className="env-label">{p.environment_name || '未绑定环境'}</div>
                            </div>
                        </div>
                    ))}
                    {filteredProjects.length === 0 && <div className="empty-state">未找到匹配项目</div>}
                </div>
            </aside>

            {/* Right Main Area: Module list & controls */}
            <main className="deploy-main">
                {selectedProject ? (
                    <div className="module-view">
                        <div className="view-header">
                            <div className="project-title">
                                <h2>{selectedProject.name} <span className="badge">v1.2.0</span></h2>
                                <p className="description">{selectedProject.description || '暂无项目描述'}</p>
                            </div>
                            <div className="env-status">
                                <span className="label">目标环境:</span>
                                <span className="value">{selectedProject.environment_name}</span>
                                <span className="tag">已锁定</span>
                            </div>
                        </div>

                        <div className="module-grid">
                            {selectedProject.modules?.map((m: any) => {
                                const state = deployStates[m.id] || { status: '', progress: 0, file: null, isUploading: false };
                                return (
                                    <div key={m.id} className="module-card">
                                        <div className="module-head">
                                            <div className="m-type">{m.type.toUpperCase()}</div>
                                            <h3>{m.name}</h3>
                                        </div>

                                        <div className="module-body">
                                            <div className="file-input-wrapper">
                                                <input
                                                    type="file"
                                                    id={`file-${m.id}`}
                                                    onChange={(e) => updateModuleState(m.id, { file: e.target.files?.[0] || null })}
                                                    disabled={state.isUploading}
                                                />
                                                <label htmlFor={`file-${m.id}`} className={state.file ? 'has-file' : ''}>
                                                    {state.file ? state.file.name : '选择发布包 (JAR/ZIP/WAR)'}
                                                </label>
                                            </div>

                                            {state.status && (
                                                <div className={`status-info ${state.status.includes('错误') || state.status.includes('异常') ? 'error' : (state.status.includes('成功') ? 'success' : '')}`}>
                                                    <div className="status-text">{state.status}</div>
                                                    {state.isUploading && (
                                                        <div className="mini-progress">
                                                            <div className="fill" style={{ width: `${state.progress}%` }}></div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="module-footer">
                                            <div className="footer-controls">
                                                <label className="toggle-restart">
                                                    <input
                                                        type="checkbox"
                                                        checked={state.skipRestart}
                                                        onChange={(e) => updateModuleState(m.id, { skipRestart: e.target.checked })}
                                                    />
                                                    <span className="toggle-text">不进行服务重启</span>
                                                </label>
                                                <button
                                                    className="btn-restart-only"
                                                    disabled={state.isUploading}
                                                    onClick={() => handleManualRestart(m.id)}
                                                >
                                                    仅重启服务
                                                </button>
                                            </div>
                                            <button
                                                className="btn-deploy"
                                                disabled={!state.file || state.isUploading}
                                                onClick={() => handleUpload(m.id)}
                                            >
                                                {state.isUploading ? '正在发布...' : '确认发布'}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="no-selection">
                        <div className="icon">📂</div>
                        <h3>请在左侧选择一个项目</h3>
                        <p>选择项目后，可查看所属模块并执行发布任务</p>
                    </div>
                )}
            </main>

            <style jsx>{`
                .deploy-layout {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    height: calc(100vh - 64px);
                    background: #f8fafc;
                }
                
                /* Sidebar */
                .project-sidebar {
                    background: #fff;
                    border-right: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                }
                .sidebar-header { padding: 20px; border-bottom: 1px solid #f1f5f9; }
                .sidebar-header h3 { font-size: 16px; margin-bottom: 16px; color: #1e293b; }
                .search-box input {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 13px;
                }
                .sidebar-content { flex: 1; overflow-y: auto; padding: 12px; }
                .project-item {
                    display: flex;
                    align-items: center;
                    padding: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-bottom: 4px;
                    transition: all 0.2s;
                }
                .project-item:hover { background: #f1f5f9; }
                .project-item.active { background: #eff6ff; border-left: 4px solid #2563eb; }
                .project-icon { font-size: 20px; margin-right: 12px; }
                .project-item .name { font-size: 14px; font-weight: 500; color: #334155; }
                .project-item .env-label { font-size: 11px; color: #94a3b8; margin-top: 2px; }
                
                /* Main Area */
                .deploy-main { padding: 32px; overflow-y: auto; }
                .no-selection {
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #94a3b8;
                }
                .no-selection .icon { font-size: 64px; margin-bottom: 24px; opacity: 0.5; }
                
                /* Module View */
                .view-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 32px;
                }
                .project-title h2 { font-size: 24px; color: #0f172a; margin-bottom: 8px; }
                .project-title .badge {
                    font-size: 12px;
                    background: #f1f5f9;
                    padding: 2px 8px;
                    border-radius: 12px;
                    vertical-align: middle;
                    margin-left: 8px;
                    color: #64748b;
                }
                .project-title .description { color: #64748b; font-size: 14px; }
                
                .env-status {
                    background: #fff;
                    padding: 12px 20px;
                    border-radius: 10px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .env-status .label { font-size: 13px; color: #94a3b8; }
                .env-status .value { font-size: 14px; font-weight: 600; color: #2563eb; }
                .env-status .tag {
                    font-size: 11px;
                    background: #ecfdf5;
                    color: #059669;
                    padding: 2px 6px;
                    border-radius: 4px;
                }

                .module-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
                    gap: 24px;
                }
                .module-card {
                    background: #fff;
                    border-radius: 12px;
                    padding: 24px;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.2s;
                    border: 1px solid transparent;
                }
                .module-card:hover { transform: translateY(-4px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); border-color: #e2e8f0; }
                .module-head { margin-bottom: 20px; }
                .m-type { font-size: 10px; font-weight: 700; color: #6366f1; letter-spacing: 0.05em; margin-bottom: 4px; }
                .module-head h3 { font-size: 18px; color: #1e293b; }
                
                .module-body { flex: 1; margin-bottom: 24px; }
                .file-input-wrapper { position: relative; }
                .file-input-wrapper input {
                    position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer;
                }
                .file-input-wrapper label {
                    display: block;
                    padding: 16px;
                    border: 2px dashed #e2e8f0;
                    border-radius: 8px;
                    text-align: center;
                    font-size: 13px;
                    color: #64748b;
                    transition: all 0.2s;
                    word-break: break-all;
                }
                .file-input-wrapper:hover label { border-color: #2563eb; color: #2563eb; background: #eff6ff; }
                .file-input-wrapper label.has-file { border-color: #10b981; color: #10b981; background: #ecfdf5; font-weight: 500; }

                .status-info { margin-top: 16px; padding: 12px; border-radius: 6px; background: #f8fafc; }
                .status-text { font-size: 12px; color: #475569; margin-bottom: 8px; }
                .status-info.error { background: #fef2f2; }
                .status-info.error .status-text { color: #dc2626; }
                .status-info.success { background: #f0fdf4; }
                .status-info.success .status-text { color: #16a34a; }

                .mini-progress { height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
                .mini-progress .fill { height: 100%; background: #2563eb; transition: width 0.3s; }

                .footer-controls {
                    margin-bottom: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .toggle-restart {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    user-select: none;
                }
                .btn-restart-only {
                    font-size: 12px;
                    color: #4b5563;
                    background: #f3f4f6;
                    border: 1px solid #e5e7eb;
                    padding: 4px 10px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-restart-only:hover {
                    background: #e5e7eb;
                    color: #1f2937;
                }
                .btn-restart-only:disabled {
                    color: #9ca3af;
                    background: #f9fafb;
                    border-color: #f3f4f6;
                    cursor: not-allowed;
                }
                .toggle-restart input {
                    width: 16px;
                    height: 16px;
                    cursor: pointer;
                }
                .toggle-text {
                    font-size: 12px;
                    color: #64748b;
                }
                .toggle-restart:hover .toggle-text {
                    color: #1e293b;
                }

                .btn-deploy {
                    width: 100%;
                    padding: 12px;
                    background: #2563eb;
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-deploy:hover { background: #1d4ed8; transform: translateY(-1px); box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2); }
                .btn-deploy:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }
            `}</style>
        </div>
    );
}
