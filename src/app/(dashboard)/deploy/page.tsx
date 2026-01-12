'use client';

import { useState, useEffect, useMemo } from 'react';
import { LogModal } from '@/components/LogModal';

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
        timestamp: string | null;
        duration: number | null;
        deployed: boolean; // Prevent duplicate deployments
    }>>({});

    // Log Modal state
    const [showLogModal, setShowLogModal] = useState(false);
    const [logModuleId, setLogModuleId] = useState<number | null>(null);
    const [logModuleName, setLogModuleName] = useState<string>('');
    const [logEnvironmentId, setLogEnvironmentId] = useState<number | null>(null);

    // Drag and Drop state
    const [isDragging, setIsDragging] = useState<Record<number, boolean>>({});

    useEffect(() => {
        const loadData = async () => {
            const [projRes, envRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/environments')
            ]);
            if (projRes.ok && envRes.ok) {
                const projData = await projRes.json();
                const envData = await envRes.json();
                setProjects(projData);
                setEnvironments(envData);

                // Auto-select first project if available
                if (projData.length > 0) {
                    setSelectedProjectId(projData[0].id);
                }
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
            [moduleId]: { ...(prev[moduleId] || { status: '', progress: 0, file: null, isUploading: false, skipRestart: false, timestamp: null, duration: null, deployed: false }), ...updates }
        }));
    };

    useEffect(() => {
        setIsDragging({});
    }, [selectedProjectId]);

    const handleDragOver = (e: React.DragEvent, moduleId: number) => {
        e.preventDefault();
        setIsDragging(prev => ({ ...prev, [moduleId]: true }));
    };

    const handleDragLeave = (e: React.DragEvent, moduleId: number) => {
        e.preventDefault();
        setIsDragging(prev => ({ ...prev, [moduleId]: false }));
    };

    const handleDrop = (e: React.DragEvent, moduleId: number) => {
        e.preventDefault();
        setIsDragging(prev => ({ ...prev, [moduleId]: false }));

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            updateModuleState(moduleId, { file, deployed: false });
            // Optionally auto-trigger upload
            // setTimeout(() => handleUpload(moduleId, file), 100);
        }
    };

    const handleUpload = async (moduleId: number, forcedFile?: File) => {
        const state = deployStates[moduleId];
        const file = forcedFile || state?.file;
        if (!file) return;

        const startTime = Date.now();
        updateModuleState(moduleId, { isUploading: true, status: '正在上传...', progress: 0, timestamp: null, duration: null });

        try {
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
                    environmentId: selectedProject?.environment_id, // Always use project environment
                    fileName: file.name,
                    skipRestart: state.skipRestart
                })
            });

            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000); // seconds
            const timestamp = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');

            if (deployRes.ok) {
                updateModuleState(moduleId, {
                    status: '部署成功！',
                    isUploading: false,
                    timestamp,
                    duration,
                    deployed: true  // Mark as deployed
                });
            } else {
                const errorData = await deployRes.json().catch(() => ({}));
                updateModuleState(moduleId, {
                    status: `错误: ${errorData.error || '部署失败'}`,
                    isUploading: false,
                    timestamp,
                    duration
                });
            }
        } catch (error: any) {
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            const timestamp = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');
            updateModuleState(moduleId, {
                status: `异常: ${error.message}`,
                isUploading: false,
                timestamp,
                duration
            });
        }
    };

    const handleManualRestart = async (moduleId: number) => {
        const startTime = Date.now();
        updateModuleState(moduleId, { isUploading: true, status: '正在尝试重启服务...', timestamp: null, duration: null });
        try {
            const res = await fetch('/api/deploy/restart', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moduleId: moduleId,
                    environmentId: selectedProject?.environment_id
                })
            });

            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            const timestamp = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');

            if (res.ok) {
                updateModuleState(moduleId, {
                    status: '服务重启成功！',
                    isUploading: false,
                    timestamp,
                    duration
                });
            } else {
                const data = await res.json().catch(() => ({}));
                updateModuleState(moduleId, {
                    status: `重启失败: ${data.error || '未知错误'}`,
                    isUploading: false,
                    timestamp,
                    duration
                });
            }
        } catch (error: any) {
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            const timestamp = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');
            updateModuleState(moduleId, {
                status: `操作异常: ${error.message}`,
                isUploading: false,
                timestamp,
                duration
            });
        }
    };

    const handleManualStop = async (moduleId: number) => {
        if (!confirm('确定要停止该服务吗？')) return;

        const startTime = Date.now();
        updateModuleState(moduleId, { isUploading: true, status: '正在停止服务...', timestamp: null, duration: null });
        try {
            const res = await fetch('/api/deploy/stop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    moduleId: moduleId,
                    environmentId: selectedProject?.environment_id
                })
            });

            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            const timestamp = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');

            if (res.ok) {
                updateModuleState(moduleId, {
                    status: '服务已停止',
                    isUploading: false,
                    timestamp,
                    duration
                });
            } else {
                const data = await res.json().catch(() => ({}));
                updateModuleState(moduleId, {
                    status: `停止失败: ${data.error || '未知错误'}`,
                    isUploading: false,
                    timestamp,
                    duration
                });
            }
        } catch (error: any) {
            const endTime = Date.now();
            const duration = Math.round((endTime - startTime) / 1000);
            const timestamp = new Date().toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).replace(/\//g, '-');
            updateModuleState(moduleId, {
                status: `停止异常: ${error.message}`,
                isUploading: false,
                timestamp,
                duration
            });
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
                <div className="main-header">
                    <div className="header-left">
                        {selectedProject ? (
                            <>
                                <h2>{selectedProject.name} <span className="badge">v1.2.0</span></h2>
                                <p className="description">{selectedProject.description || '项目部署详情'}</p>
                            </>
                        ) : (
                            <h2>请选择项目</h2>
                        )}
                    </div>
                    <div className="header-right">
                        {selectedProject && (
                            <div className="env-selector-wrapper readonly">
                                <span className="label">服务器:</span>
                                <span className="env-value">
                                    {selectedProject.environment_name || '未指定'}
                                </span>
                                <span className="tag locked">已锁定</span>
                            </div>
                        )}
                    </div>
                </div>

                {selectedProject ? (
                    <div className="module-grid">
                        {selectedProject.modules?.map((m: any) => {
                            const state = deployStates[m.id] || { status: '', progress: 0, file: null, isUploading: false, timestamp: null, duration: null, deployed: false, skipRestart: false };
                            const dragging = isDragging[m.id];

                            return (
                                <div
                                    key={m.id}
                                    className={`module-card ${dragging ? 'dragging' : ''} ${state.isUploading ? 'uploading' : ''}`}
                                    onDragOver={(e) => handleDragOver(e, m.id)}
                                    onDragLeave={(e) => handleDragLeave(e, m.id)}
                                    onDrop={(e) => handleDrop(e, m.id)}
                                >
                                    <div className="card-header">
                                        <h3 className="module-title">{m.name}</h3>
                                        <div className="status-badge">
                                            <span className={`status-dot ${state.status.includes('成功') ? 'online' : (state.status.includes('错误') || state.status.includes('异常') ? 'offline' : (state.isUploading ? 'busy' : 'idle'))}`}></span>
                                            <span className="status-label">
                                                {state.isUploading ? '正在同步' : (state.status.includes('成功') ? '已上线' : '就绪')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="card-body">
                                        <div className="module-meta">
                                            <div className="type-tag">{m.type.toUpperCase()}</div>
                                            <div className="remote-path" title={m.remote_path}>{m.remote_path}</div>
                                        </div>

                                        <div
                                            className={`drop-zone ${state.file ? 'has-file' : ''}`}
                                            onClick={() => document.getElementById(`file-${m.id}`)?.click()}
                                        >
                                            <input
                                                type="file"
                                                id={`file-${m.id}`}
                                                className="hidden-input"
                                                onChange={(e) => updateModuleState(m.id, { file: e.target.files?.[0] || null, deployed: false })}
                                                disabled={state.isUploading}
                                            />
                                            <div className="zone-content">
                                                <div className="icon">{state.file ? '📄' : '☁️'}</div>
                                                <div className="text">
                                                    {state.file ? state.file.name : '拖拽 JAR/ZIP 文件到此'}
                                                </div>
                                            </div>
                                            {state.isUploading && (
                                                <div className="progress-overlay" style={{ height: `${state.progress}%` }}></div>
                                            )}
                                        </div>

                                        {state.status && (
                                            <div className={`deploy-status ${state.status.includes('成功') ? 'success' : (state.status.includes('错误') || state.status.includes('异常') ? 'error' : 'info')}`}>
                                                <div className="status-msg">
                                                    <span className="msg-text">{state.status}</span>
                                                    {!state.isUploading && (
                                                        <button className="clear-minimal" onClick={() => updateModuleState(m.id, { status: '', timestamp: null, duration: null })}>✕</button>
                                                    )}
                                                </div>
                                                {state.timestamp && (
                                                    <div className="status-time">
                                                        <span>📅 {state.timestamp}</span>
                                                        {state.duration !== null && <span>⏱ {state.duration}s</span>}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="card-actions">
                                        <div className="top-actions">
                                            <button
                                                className="action-btn deploy-trigger"
                                                disabled={!state.file || state.isUploading || state.deployed}
                                                onClick={() => handleUpload(m.id)}
                                            >
                                                {state.isUploading ? `发布中 ${state.progress}%` : (state.deployed ? '重新发布' : '立即发布')}
                                            </button>
                                            <button
                                                className="action-btn log-btn"
                                                onClick={() => {
                                                    setLogModuleId(m.id);
                                                    setLogModuleName(m.name);
                                                    setLogEnvironmentId(selectedProject.environment_id || null);
                                                    setShowLogModal(true);
                                                }}
                                            >
                                                📋 查看日志
                                            </button>
                                        </div>
                                        <div className="bottom-actions">
                                            <div className="control-group">
                                                <button
                                                    className="control-btn stop"
                                                    onClick={() => handleManualStop(m.id)}
                                                    disabled={state.isUploading}
                                                >
                                                    ⏹ 停止
                                                </button>
                                                <button
                                                    className="control-btn restart"
                                                    onClick={() => handleManualRestart(m.id)}
                                                    disabled={state.isUploading}
                                                >
                                                    🔄 重启
                                                </button>
                                            </div>
                                            <label className="checkbox-mini">
                                                <input
                                                    type="checkbox"
                                                    checked={state.skipRestart}
                                                    onChange={(e) => updateModuleState(m.id, { skipRestart: e.target.checked })}
                                                />
                                                跳过重启
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="no-selection">
                        <div className="icon">📂</div>
                        <h3>请在左侧选择一个项目</h3>
                        <p>选择项目后，可查看所属模块并执行发布任务</p>
                    </div>
                )}
            </main>

            {/* Log Modal */}
            {showLogModal && logModuleId && (
                <LogModal
                    moduleId={logModuleId}
                    moduleName={logModuleName}
                    environmentId={logEnvironmentId}
                    onClose={() => setShowLogModal(false)}
                />
            )}

            <style jsx>{`
                .deploy-layout {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    height: calc(100vh - 64px);
                    background: #f1f5f9;
                }
                
                /* Sidebar remains similar but cleaner */
                .project-sidebar {
                    background: #fff;
                    border-right: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    z-index: 10;
                }
                .sidebar-header { padding: 24px 20px; border-bottom: 1px solid #f1f5f9; }
                .sidebar-header h3 { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
                .search-box input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 13px;
                    background: #f8fafc;
                    transition: border 0.2s;
                }
                .search-box input:focus { border-color: #3b82f6; outline: none; }
                .sidebar-content { flex: 1; overflow-y: auto; padding: 12px; }
                
                .project-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 4px;
                }
                .project-item:hover { background: #f8fafc; }
                .project-item.active { background: #eff6ff; }
                .project-icon { font-size: 20px; }
                .project-info .name { font-weight: 600; font-size: 14px; color: #1e293b; }
                .project-info .env-label { font-size: 12px; color: #64748b; }
                .project-item.active .project-info .name { color: #2563eb; }

                /* Main Content Area */
                .deploy-main {
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                }

                .main-header {
                    padding: 24px 32px;
                    background: #fff;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    z-index: 5;
                }

                .header-left h2 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
                .header-left h2 .badge {
                    font-size: 12px;
                    background: #f1f5f9;
                    color: #64748b;
                    padding: 2px 8px;
                    border-radius: 12px;
                    vertical-align: middle;
                    margin-left: 8px;
                }
                .header-left .description { font-size: 14px; color: #64748b; margin: 0; }

                .env-selector-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: #f8fafc;
                    padding: 8px 16px;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                }
                .env-selector-wrapper.readonly {
                    cursor: default;
                    background: #f1f5f9;
                }
                .env-value {
                    font-size: 14px;
                    font-weight: 700;
                    color: #2563eb;
                }
                .tag.locked {
                    font-size: 10px;
                    background: #e2e8f0;
                    color: #64748b;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                }

                /* Module Grid and Cards */
                .module-grid {
                    padding: 32px;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
                    gap: 24px;
                }

                .module-card {
                    background: #fff;
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    transition: all 0.3s ease;
                    position: relative;
                }
                .module-card:hover { 
                    box-shadow: 0 10px 20px rgba(0,0,0,0.05);
                    border-color: #3b82f640;
                }
                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .module-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: #0f172a;
                    margin: 0;
                    word-break: break-all;
                    flex: 1;
                    margin-right: 12px;
                }
                .status-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 8px;
                    background: #f8fafc;
                    border-radius: 20px;
                    border: 1px solid #f1f5f9;
                }
                .status-dot { width: 6px; height: 6px; border-radius: 50%; }
                .status-dot.online { background: #10b981; box-shadow: 0 0 6px #10b981; }
                .status-dot.offline { background: #ef4444; }
                .status-dot.busy { background: #f59e0b; animation: pulse 1.5s infinite; }
                .status-dot.idle { background: #cbd5e1; }
                .status-label { font-size: 11px; font-weight: 700; color: #64748b; }

                .card-body {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .module-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .type-tag {
                    font-size: 9px;
                    font-weight: 800;
                    background: #334155;
                    color: #fff;
                    padding: 2px 6px;
                    border-radius: 3px;
                }
                .remote-path {
                    font-size: 11px;
                    color: #94a3b8;
                    font-family: monospace;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;
                }

                .drop-zone {
                    height: 80px;
                    border: 2px dashed #e2e8f0;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                    background: #fcfdfe;
                }
                .drop-zone:hover { border-color: #3b82f6; background: #f8fafc; }
                .drop-zone.has-file { border-color: #10b981; background: #f0fdf4; border-style: solid; }
                
                .hidden-input { display: none; }
                .zone-content { text-align: center; z-index: 1; }
                .zone-content .icon { font-size: 20px; margin-bottom: 4px; }
                .zone-content .text { font-size: 12px; font-weight: 600; color: #475569; }

                .progress-overlay {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(59, 130, 246, 0.1);
                    transition: height 0.3s;
                }

                .deploy-status {
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 12px;
                }
                .deploy-status.success { background: #f0fdf4; color: #166534; border: 1px solid #dcfce7; }
                .deploy-status.error { background: #fef2f2; color: #991b1b; border: 1px solid #fee2e2; }
                .deploy-status.info { background: #f8fafc; color: #64748b; border: 1px solid #f1f5f9; }

                .status-msg { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
                .msg-text { font-weight: 600; line-height: 1.4; }
                .clear-minimal {
                    background: none; border: none; color: currentColor; font-size: 12px;
                    cursor: pointer; padding: 2px; opacity: 0.6; transition: opacity 0.2s;
                }
                .clear-minimal:hover { opacity: 1; }

                .status-time { font-size: 11px; color: #64748b; display: flex; gap: 12px; }

                .card-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-top: auto;
                }
                .top-actions {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                .action-btn {
                    padding: 10px;
                    border-radius: 8px;
                    font-size: 13px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                }
                .deploy-trigger {
                    background: #2563eb;
                    color: #fff;
                }
                .deploy-trigger:hover:not(:disabled) { background: #1d4ed8; }
                .deploy-trigger:disabled { background: #e2e8f0; color: #94a3b8; cursor: not-allowed; }

                .log-btn {
                    background: #f59e0b;
                    color: #fff;
                }
                .log-btn:hover { background: #d97706; }

                .bottom-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .control-group {
                    display: flex;
                    gap: 8px;
                }
                .control-btn {
                    padding: 6px 12px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    background: #fff;
                    transition: all 0.2s;
                }
                .control-btn.stop {
                    border: 1px solid #fee2e2;
                    color: #ef4444;
                }
                .control-btn.stop:hover:not(:disabled) {
                    background: #fef2f2;
                }
                .control-btn.restart {
                    border: 1px solid #dbeafe;
                    color: #3b82f6;
                }
                .control-btn.restart:hover:not(:disabled) {
                    background: #eff6ff;
                }
                .control-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .checkbox-mini {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: #64748b;
                    font-weight: 600;
                    cursor: pointer;
                }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.1); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
}
