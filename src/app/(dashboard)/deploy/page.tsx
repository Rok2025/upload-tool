'use client';

import { useState, useEffect, useMemo } from 'react';
import { LogModal } from '@/components/LogModal';
import { useDeployment } from '@/components/DeploymentProvider';

export default function DeployPage() {
    const { activeDeployments } = useDeployment();
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
    const [logPaths, setLogPaths] = useState<string[]>([]);

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

    // Sync active deployments from Global Context to Local State
    useEffect(() => {
        activeDeployments.forEach(deploy => {
            // Only update if we don't have a local "uploading" state (to avoid jitter during the upload phase)
            // Or if we are in initial load (state is empty)
            setDeployStates(prev => {
                const current = prev[deploy.module_id];
                // If we already think it's uploading/deploying, we might just want to leave it
                // BUT if we refreshed, current is undefined/empty.
                // Or if we are "Starting distribution...", the DB says "running".

                // Let's force update if it's "running" in DB and we aren't "uploading" (file upload).
                // Actually, DB log is created at start of distribution.

                if (current?.status === '正在上传...') return prev; // Don't interrupt upload progress

                const startTime = new Date(deploy.start_time).toLocaleString('zh-CN', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', hour12: false
                }).replace(/\//g, '-');

                return {
                    ...prev,
                    [deploy.module_id]: {
                        ...(current || {}),
                        status: '正在部署中 (后台任务)',
                        isUploading: true, // Lock buttons
                        progress: 100, // Background tasks are "processing", so show full bar or indeterminate
                        timestamp: startTime,
                        deployed: false,
                        file: current?.file || null
                    }
                };
            });
        });
    }, [activeDeployments]);

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
        e.stopPropagation();
        setIsDragging(prev => ({ ...prev, [moduleId]: false }));

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            const module = selectedProject?.modules.find((m: any) => m.id === moduleId);
            if (module) {
                const allowedStr = getAllowedExtensions(module);
                if (allowedStr) {
                    const allowed = allowedStr.split(',').map((ext: string) => ext.trim().toLowerCase());
                    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
                    const isAllowed = allowed.some((ext: string) => ext === fileExt || file.name.toLowerCase().endsWith(ext));

                    if (!isAllowed) {
                        updateModuleState(moduleId, { status: `错误: 文件类型不匹配 (允许: ${allowedStr})` });
                        return;
                    }
                }
            }
            updateModuleState(moduleId, { file, deployed: false, status: '' });
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
                // Also send moduleId so backend can validate if it wants to (though we do it client side now)
                formData.append('moduleId', moduleId.toString());

                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!uploadRes.ok) {
                    const err = await uploadRes.json();
                    throw new Error(err.error || '上传分片失败');
                }

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

    // Helper to get allowed extensions
    const getAllowedExtensions = (module: any) => {
        if (module.allowed_files) return module.allowed_files;
        // Fallback based on type
        if (module.type === 'jar') return '.jar';
        if (module.type === 'zip' || module.type === 'static') return '.zip';
        return '';
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
                            // Debug log to verify allowed_files is present
                            // console.log('Module render:', m.name, m.allowed_files); 
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
                                                accept={getAllowedExtensions(m) || undefined}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) {
                                                        const allowedStr = getAllowedExtensions(m);
                                                        if (allowedStr) {
                                                            const allowed = allowedStr.split(',').map((ext: string) => ext.trim().toLowerCase());
                                                            const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
                                                            const isAllowed = allowed.some((ext: string) => ext === fileExt || file.name.toLowerCase().endsWith(ext));

                                                            if (!isAllowed) {
                                                                updateModuleState(m.id, { status: `错误: 文件类型不匹配 (允许: ${allowedStr})` });
                                                                e.target.value = ''; // Reset input
                                                                return;
                                                            }
                                                        }
                                                        updateModuleState(m.id, { file, deployed: false, status: '' });
                                                    }
                                                }}
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
                                                disabled={!state.file || state.isUploading}
                                                onClick={() => handleUpload(m.id)}
                                            >
                                                {state.isUploading ? `发布中 ${state.progress}%` : (state.deployed ? '重新发布' : '立即发布')}
                                            </button>

                                            {(() => {
                                                let hasLogs = false;
                                                if (m.log_path) {
                                                    try {
                                                        const p = JSON.parse(m.log_path);
                                                        if (Array.isArray(p) ? p.length > 0 : !!p) hasLogs = true;
                                                    } catch { hasLogs = !!m.log_path; }
                                                }
                                                return hasLogs && (
                                                    <button
                                                        className="action-btn log-btn"
                                                        onClick={() => {
                                                            setLogModuleId(m.id);
                                                            setLogModuleName(m.name);
                                                            setLogEnvironmentId(selectedProject.environment_id || null);

                                                            let paths: string[] = [];
                                                            if (m.log_path) {
                                                                try {
                                                                    const parsed = JSON.parse(m.log_path);
                                                                    if (Array.isArray(parsed)) paths = parsed;
                                                                    else paths = [m.log_path];
                                                                } catch (e) {
                                                                    paths = [m.log_path];
                                                                }
                                                            }
                                                            setLogPaths(paths);

                                                            setShowLogModal(true);
                                                        }}
                                                    >
                                                        📋 查看日志
                                                    </button>
                                                );
                                            })()}
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
            </main >

            {/* Log Modal */}
            {
                showLogModal && logModuleId && (
                    <LogModal
                        moduleId={logModuleId}
                        moduleName={logModuleName}
                        environmentId={logEnvironmentId}
                        initialLogPaths={logPaths}
                        onClose={() => setShowLogModal(false)}
                    />
                )
            }

            <style jsx>{`
                .deploy-layout {
                    display: grid;
                    grid-template-columns: 280px 1fr;
                    height: calc(100vh - 64px);
                    background: transparent;
                }
                
                .project-sidebar {
                    background: var(--bg-card);
                    backdrop-filter: var(--backdrop-blur);
                    border-right: 1px solid var(--border-subtle);
                    display: flex;
                    flex-direction: column;
                    z-index: 10;
                }
                .sidebar-header { padding: 24px 20px; border-bottom: 1px solid var(--border-light); }
                .sidebar-header h3 { font-size: 18px; font-weight: 700; margin-bottom: 16px; color: var(--text-primary); }
                .search-box input {
                    width: 100%;
                    padding: 10px 14px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    font-size: 13px;
                    background: var(--bg-input);
                    color: var(--text-primary);
                    transition: all 0.2s;
                }
                .search-box input::placeholder { color: var(--text-muted); }
                .search-box input:focus { border-color: var(--accent-primary); outline: none; box-shadow: var(--shadow-glow); }
                .sidebar-content { flex: 1; overflow-y: auto; padding: 12px; }
                
                .project-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 12px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s;
                    margin-bottom: 4px;
                    border: 1px solid transparent;
                }
                .project-item:hover { background: rgba(99, 102, 241, 0.1); }
                .project-item.active { 
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
                    border-color: var(--border-subtle);
                }
                .project-icon { font-size: 20px; }
                .project-info .name { font-weight: 600; font-size: 14px; color: var(--text-primary); }
                .project-info .env-label { font-size: 12px; color: var(--text-muted); }
                .project-item.active .project-info .name { color: var(--accent-tertiary); }
                .empty-state { text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; }

                .deploy-main {
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                }

                .main-header {
                    padding: 24px 32px;
                    background: var(--bg-card);
                    backdrop-filter: var(--backdrop-blur);
                    border-bottom: 1px solid var(--border-subtle);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    position: sticky;
                    top: 0;
                    z-index: 5;
                }

                .header-left h2 { 
                    font-size: 24px; 
                    font-weight: 800; 
                    color: var(--text-primary);
                    margin: 0 0 4px 0; 
                }
                [data-theme="dark"] .header-left h2 {
                    background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .header-left h2 .badge {
                    font-size: 12px;
                    background: rgba(99, 102, 241, 0.2);
                    color: var(--accent-primary);
                    padding: 2px 8px;
                    border-radius: 12px;
                    vertical-align: middle;
                    margin-left: 8px;
                }
                [data-theme="dark"] .header-left h2 .badge {
                    -webkit-text-fill-color: var(--accent-primary);
                }
                .header-left .description { font-size: 14px; color: var(--text-muted); margin: 0; }

                .env-selector-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: var(--bg-input);
                    padding: 8px 16px;
                    border-radius: 10px;
                    border: 1px solid var(--border-subtle);
                }
                .env-selector-wrapper .label { color: var(--text-muted); font-size: 13px; }
                .env-value {
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--accent-tertiary);
                }
                .tag.locked {
                    font-size: 10px;
                    background: rgba(99, 102, 241, 0.2);
                    color: var(--text-secondary);
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                }

                .module-grid {
                    padding: 32px;
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
                    gap: 24px;
                }

                .module-card {
                    background: var(--bg-card);
                    backdrop-filter: var(--backdrop-blur);
                    border-radius: 16px;
                    padding: 20px;
                    border: 1px solid var(--border-subtle);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                    transition: all 0.3s ease;
                    position: relative;
                }
                [data-theme="dark"] .module-card::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 20%;
                    right: 20%;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent);
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                .module-card:hover { 
                    box-shadow: var(--shadow-glow);
                }
                [data-theme="dark"] .module-card:hover {
                    border-color: rgba(99, 102, 241, 0.4);
                }
                [data-theme="dark"] .module-card:hover::before { opacity: 1; }
                .module-card.dragging {
                    border-color: var(--accent-tertiary);
                    background: rgba(34, 211, 238, 0.05);
                }
                .module-card.uploading {
                    border-color: var(--accent-primary);
                    animation: pulse-glow 2s infinite;
                }
                @keyframes pulse-glow {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4); }
                    50% { box-shadow: 0 0 20px -5px rgba(99, 102, 241, 0.6); }
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .module-title {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin: 0;
                    word-break: break-all;
                    flex: 1;
                    margin-right: 12px;
                }
                .status-badge {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 20px;
                    border: 1px solid var(--border-light);
                }
                .status-dot { width: 6px; height: 6px; border-radius: 50%; }
                .status-dot.online { background: var(--success); box-shadow: 0 0 8px var(--success); }
                .status-dot.offline { background: var(--error); }
                .status-dot.busy { background: var(--warning); animation: pulse 1.5s infinite; }
                .status-dot.idle { background: var(--text-muted); }
                .status-label { font-size: 11px; font-weight: 600; color: var(--text-secondary); }

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
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: #fff;
                    padding: 3px 8px;
                    border-radius: 4px;
                }
                .remote-path {
                    font-size: 11px;
                    color: var(--text-muted);
                    font-family: monospace;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    flex: 1;
                }

                .drop-zone {
                    height: 80px;
                    border: 2px dashed var(--border-subtle);
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    position: relative;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.02);
                }
                .drop-zone:hover { border-color: var(--accent-primary); background: rgba(99, 102, 241, 0.05); }
                .drop-zone.has-file { border-color: var(--success); background: rgba(74, 222, 128, 0.1); border-style: solid; }
                
                .hidden-input { display: none; }
                .zone-content { text-align: center; z-index: 1; }
                .zone-content .icon { font-size: 20px; margin-bottom: 4px; }
                .zone-content .text { font-size: 12px; font-weight: 600; color: var(--text-secondary); }

                .progress-overlay {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: rgba(99, 102, 241, 0.2);
                    transition: height 0.3s;
                }

                .deploy-status {
                    padding: 10px 12px;
                    border-radius: 8px;
                    font-size: 12px;
                }
                .deploy-status.success { 
                    background: rgba(74, 222, 128, 0.1); 
                    color: var(--success); 
                    border: 1px solid rgba(74, 222, 128, 0.3); 
                }
                .deploy-status.error { 
                    background: rgba(248, 113, 113, 0.1); 
                    color: var(--error); 
                    border: 1px solid rgba(248, 113, 113, 0.3); 
                }
                .deploy-status.info { 
                    background: rgba(255, 255, 255, 0.05); 
                    color: var(--text-secondary); 
                    border: 1px solid var(--border-light); 
                }

                .status-msg { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
                .msg-text { font-weight: 600; line-height: 1.4; }
                .clear-minimal {
                    background: none; border: none; color: currentColor; font-size: 12px;
                    cursor: pointer; padding: 2px; opacity: 0.6; transition: opacity 0.2s;
                }
                .clear-minimal:hover { opacity: 1; }

                .status-time { font-size: 11px; color: var(--text-muted); display: flex; gap: 12px; }

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
                    background: var(--accent-gradient);
                    color: #fff;
                    position: relative;
                    overflow: hidden;
                }
                .deploy-trigger::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    transition: left 0.5s;
                }
                .deploy-trigger:hover:not(:disabled)::after { left: 100%; }
                .deploy-trigger:hover:not(:disabled) { 
                    transform: translateY(-1px);
                    box-shadow: 0 5px 20px -5px rgba(99, 102, 241, 0.5);
                }
                .deploy-trigger:disabled { 
                    background: rgba(255, 255, 255, 0.1); 
                    color: var(--text-muted); 
                    cursor: not-allowed; 
                }

                .log-btn {
                    background: linear-gradient(135deg, #f59e0b, #d97706);
                    color: #fff;
                }
                .log-btn:hover { box-shadow: 0 5px 20px -5px rgba(245, 158, 11, 0.5); }

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
                    background: transparent;
                    transition: all 0.2s;
                }
                .control-btn.stop {
                    border: 1px solid rgba(248, 113, 113, 0.3);
                    color: var(--error);
                }
                .control-btn.stop:hover:not(:disabled) {
                    background: rgba(248, 113, 113, 0.1);
                }
                .control-btn.restart {
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    color: var(--accent-primary);
                }
                .control-btn.restart:hover:not(:disabled) {
                    background: rgba(99, 102, 241, 0.1);
                }
                .control-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }
                .checkbox-mini {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 11px;
                    color: var(--text-muted);
                    font-weight: 600;
                    cursor: pointer;
                }
                .checkbox-mini input {
                    accent-color: var(--accent-primary);
                }

                .no-selection {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-muted);
                }
                .no-selection .icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
                .no-selection h3 { font-size: 18px; color: var(--text-secondary); margin-bottom: 8px; }
                .no-selection p { font-size: 14px; }

                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.2); opacity: 0.5; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div >
    );
}
