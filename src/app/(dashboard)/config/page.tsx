'use client';

import { useState, useEffect } from 'react';

interface Environment {
    id: number;
    name: string;
    host: string;
    port: number;
    username: string;
    is_local?: boolean;
    last_test_status?: 'success' | 'error' | null;
    last_test_message?: string | null;
}

interface ModuleEnvConfig {
    id: number;
    module_id: number;
    environment_id: number;
    environment_name: string;
    remote_path: string;
    start_command: string | null;
    stop_command: string | null;
    restart_command: string | null;
}

interface Module {
    id: number;
    name: string;
    type: string;
    remote_path: string;
    log_path?: string;
    start_command?: string;
    stop_command?: string;
    restart_command?: string;
    backup_path?: string;
    allowed_files?: string;
    env_configs?: ModuleEnvConfig[];
}

interface Project {
    id: number;
    name: string;
    description: string | null;
    environment_id: number | null;
    environment_name?: string;
    base_path: string;
    modules: Module[];
}

type TabType = 'environments' | 'projects';

export default function ConfigPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('projects');

    // Modal states
    const [showProjectModal, setShowProjectModal] = useState(false);
    const [showEnvModal, setShowEnvModal] = useState(false);
    const [showModuleModal, setShowModuleModal] = useState(false);
    const [showEnvConfigModal, setShowEnvConfigModal] = useState(false);
    const [showEnvConfigFormModal, setShowEnvConfigFormModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ type: string; id: number; name: string } | null>(null);

    // Edit mode
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [editingEnv, setEditingEnv] = useState<Environment | null>(null);
    const [editingModule, setEditingModule] = useState<Module | null>(null);
    const [editingEnvConfig, setEditingEnvConfig] = useState<ModuleEnvConfig | null>(null);
    const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
    const [moduleEnvConfigs, setModuleEnvConfigs] = useState<ModuleEnvConfig[]>([]);

    // Collapsed state for projects (key: projectId, value: true = expanded)
    // Default: false (collapsed)
    const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});

    const toggleProject = (projectId: number) => {
        setExpandedProjects(prev => ({ ...prev, [projectId]: !prev[projectId] }));
    };

    const [testingEnvId, setTestingEnvId] = useState<number | string | null>(null);
    const [testResults, setTestResults] = useState<Record<number | string, { success: boolean; message: string }>>({});
    const [visibleMsgId, setVisibleMsgId] = useState<number | string | null>(null);

    const handleTestConnection = async (envData?: any) => {
        const id = envData?.id || (editingEnv ? editingEnv.id : null);
        const testId = id || 'new';
        setTestingEnvId(testId);
        setVisibleMsgId(null);

        try {
            const body = id ? { id } : { ...envForm };
            const res = await fetch('/api/environments/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();

            if (res.ok) {
                setTestResults(prev => ({ ...prev, [testId]: { success: true, message: data.message } }));
            } else {
                setTestResults(prev => ({ ...prev, [testId]: { success: false, message: data.error } }));
            }
            // Show message for 3 seconds
            setVisibleMsgId(testId);
            setTimeout(() => setVisibleMsgId(null), 3000);
        } catch (error: any) {
            setTestResults(prev => ({ ...prev, [testId]: { success: false, message: '测试失败: ' + error.message } }));
            setVisibleMsgId(testId);
            setTimeout(() => setVisibleMsgId(null), 3000);
        } finally {
            setTestingEnvId(null);
        }
    };

    // Form states
    const [projectForm, setProjectForm] = useState({ name: '', description: '', environment_id: 0, base_path: '' });
    const [envForm, setEnvForm] = useState({ name: '', host: '', port: 22, username: '', password: '', is_local: false });
    const [moduleForm, setModuleForm] = useState<{
        name: string;
        type: string;
        remote_path: string;
        log_paths: string[];
        start_command: string;
        stop_command: string;
        restart_command: string;
        backup_path: string;
        allowed_files: string;
    }>({ name: '', type: 'jar', remote_path: '', log_paths: [], start_command: '', stop_command: '', restart_command: '', backup_path: '', allowed_files: '' });
    const [envConfigForm, setEnvConfigForm] = useState({ environment_id: 0, remote_path: '', start_command: '', stop_command: '', restart_command: '' });

    const fetchData = async () => {
        setLoading(true);
        const [projRes, envRes] = await Promise.all([
            fetch('/api/projects'),
            fetch('/api/environments')
        ]);
        if (projRes.ok) setProjects(await projRes.json());
        if (envRes.ok) setEnvironments(await envRes.json());
        setLoading(false);
    };

    useEffect(() => { fetchData(); }, []);

    // Reset forms
    const resetProjectForm = () => { setProjectForm({ name: '', description: '', environment_id: 0, base_path: '' }); setEditingProject(null); };
    const resetEnvForm = () => { setEnvForm({ name: '', host: '', port: 22, username: '', password: '', is_local: false }); setEditingEnv(null); };
    const resetModuleForm = () => {
        setModuleForm({
            name: '',
            type: 'jar',
            remote_path: '',
            log_paths: [], // Default to empty
            start_command: '',
            stop_command: '',
            restart_command: '',
            backup_path: '',
            allowed_files: ''
        });
        setEditingModule(null);
    };

    // Open edit modals
    const openEditProject = (p: Project) => {
        setEditingProject(p);
        setProjectForm({
            name: p.name,
            description: p.description || '',
            environment_id: p.environment_id || 0,
            base_path: p.base_path || ''
        });
        setShowProjectModal(true);
    };

    const openEditEnv = (e: Environment) => {
        setEditingEnv(e);
        setEnvForm({ name: e.name, host: e.host, port: e.port, username: e.username, password: '', is_local: !!e.is_local });
        setShowEnvModal(true);
    };

    const openEditModule = (m: Module, projectId: number) => {
        setEditingModule(m);
        setActiveProjectId(projectId);
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
        if (paths.length === 0) {
            // Do not force add default path, allow empty
        }
        setModuleForm({
            name: m.name,
            type: m.type,
            remote_path: m.remote_path,
            log_paths: paths,
            start_command: m.start_command || '',
            stop_command: m.stop_command || '',
            restart_command: m.restart_command || '',
            backup_path: '',
            allowed_files: m.allowed_files || ''
        });
        setShowModuleModal(true);
    };

    const openEnvConfig = async (m: Module) => {
        setEditingModule(m);
        const res = await fetch(`/api/module-configs?moduleId=${m.id}`);
        if (res.ok) setModuleEnvConfigs(await res.json());
        setShowEnvConfigModal(true);
    };

    const handleAddEnvConfig = () => {
        setEditingEnvConfig(null);
        setEnvConfigForm({ environment_id: 0, remote_path: editingModule?.remote_path || '', start_command: editingModule?.start_command || '', stop_command: editingModule?.stop_command || '', restart_command: editingModule?.restart_command || '' });
        setShowEnvConfigFormModal(true);
    };

    const openEditEnvConfig = (cfg: ModuleEnvConfig) => {
        setEditingEnvConfig(cfg);
        setEnvConfigForm({ environment_id: cfg.environment_id, remote_path: cfg.remote_path, start_command: cfg.start_command || '', stop_command: cfg.stop_command || '', restart_command: cfg.restart_command || '' });
        setShowEnvConfigFormModal(true);
    };

    // Handlers
    const handleSaveProject = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = editingProject ? 'PUT' : 'POST';
        const body = editingProject ? { ...projectForm, id: editingProject.id } : projectForm;
        const res = await fetch('/api/projects', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...body,
                environment_id: body.environment_id || null
            })
        });
        if (res.ok) { setShowProjectModal(false); resetProjectForm(); fetchData(); }
    };

    const handleSaveEnv = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = editingEnv ? 'PUT' : 'POST';
        const body = editingEnv ? { ...envForm, id: editingEnv.id } : envForm;
        const res = await fetch('/api/environments', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { setShowEnvModal(false); resetEnvForm(); fetchData(); }
    };

    const handleSaveModule = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = editingModule ? 'PUT' : 'POST';
        const finalLogPath = JSON.stringify(moduleForm.log_paths.filter(p => p.trim()));

        // Auto-derive allowed_files based on type
        let derivedAllowedFiles = '';
        if (moduleForm.type === 'jar') derivedAllowedFiles = '.jar';
        else if (moduleForm.type === 'zip' || moduleForm.type === 'static') derivedAllowedFiles = '.zip';

        const bodyContent = {
            ...moduleForm,
            allowed_files: derivedAllowedFiles,
            log_path: finalLogPath
        };
        // Remove log_paths from request body to match API expectation (though API ignores extras usually, cleaner to remove)
        const { log_paths, ...apiBody } = bodyContent as any;

        const body = editingModule ? { ...apiBody, id: editingModule.id } : { ...apiBody, project_id: activeProjectId };
        const res = await fetch('/api/modules', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { setShowModuleModal(false); resetModuleForm(); fetchData(); }
    };

    const handleSaveEnvConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        const body = { ...envConfigForm, module_id: editingModule?.id };
        const res = await fetch('/api/module-configs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) {
            setShowEnvConfigFormModal(false);
            if (editingModule) openEnvConfig(editingModule);
            fetchData();
        }
    };

    const handleDeleteEnvConfig = async (id: number) => {
        if (!confirm('确定要删除此服务器配置吗？')) return;
        const res = await fetch(`/api/module-configs?id=${id}`, { method: 'DELETE' });
        if (res.ok && editingModule) openEnvConfig(editingModule);
        fetchData();
    };

    const handleDelete = async () => {
        if (!showDeleteConfirm) return;
        const { type, id } = showDeleteConfirm;
        await fetch(`/api/${type}?id=${id}`, { method: 'DELETE' });
        setShowDeleteConfirm(null);
        fetchData();
    };

    const handleAddProject = () => {
        resetProjectForm();
        setShowProjectModal(true);
    };

    const handleAddModule = (projectId: number) => {
        resetModuleForm();
        setActiveProjectId(projectId);
        setShowModuleModal(true);
    };

    const handleAddEnv = () => {
        resetEnvForm();
        setShowEnvModal(true);
    };

    const handleSetLocal = async (env: Environment) => {
        if (env.is_local) return; // Already local

        const currentLocal = environments.find(e => e.is_local);
        if (currentLocal) {
            if (!confirm(`已经存在 "${currentLocal.name}" 作为部署服务器 (本机)。\n\n是否继续设定 "${env.name}" 为新的部署服务器？\n(原部署服务器将自动取消该标记)`)) return;
        } else {
            if (!confirm(`确认将 "${env.name}" 设为部署服务器 (本机) 吗？`)) return;
        }

        try {
            const res = await fetch('/api/environments', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: env.id, name: env.name, host: env.host, port: env.port, username: env.username, is_local: true })
            });
            if (!res.ok) throw new Error('操作失败');
            await fetchData();
        } catch (error: any) {
            alert(error.message);
        }
    };

    if (loading) return <div className="loading">加载中...</div>;

    return (
        <div className="config-layout">
            {/* Left Tab Menu */}
            <div className="config-sidebar">
                <h3>配置管理</h3>
                <nav className="config-nav">
                    <button
                        type="button"
                        className={`nav-item ${activeTab === 'environments' ? 'active' : ''}`}
                        onClick={() => setActiveTab('environments')}
                    >
                        <span className="nav-icon">🖥️</span>
                        服务器配置
                    </button>
                    <button
                        type="button"
                        className={`nav-item ${activeTab === 'projects' ? 'active' : ''}`}
                        onClick={() => setActiveTab('projects')}
                    >
                        <span className="nav-icon">📁</span>
                        项目配置
                    </button>
                </nav>
            </div>

            {/* Right Content Area */}
            <div className="config-content">
                {activeTab === 'environments' && (
                    <div className="section-card">
                        <div className="header-actions">
                            <h2>服务器配置</h2>
                            <button type="button" className="btn-primary" onClick={handleAddEnv}>+ 新增服务器</button>
                        </div>
                        <div className="env-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                            {environments.map(env => {
                                const activeResult = testResults[env.id];
                                const persistedStatus = env.last_test_status;
                                const currentStatus = testingEnvId === env.id ? 'testing' : (activeResult ? (activeResult.success ? 'success' : 'error') : persistedStatus);
                                const currentMsg = activeResult ? activeResult.message : (persistedStatus ? env.last_test_message : '');

                                return (
                                    <div
                                        key={env.id}
                                        className="env-badge"
                                        style={{
                                            background: env.is_local ? '#f5f3ff' : undefined,
                                            borderColor: env.is_local ? '#8b5cf6' : undefined,
                                            borderWidth: env.is_local ? '1px' : undefined,
                                            borderStyle: env.is_local ? 'solid' : undefined
                                        }}
                                    >
                                        <span
                                            className={`dot ${currentStatus}`}
                                            onMouseEnter={() => setVisibleMsgId(env.id)}
                                            onMouseLeave={() => setVisibleMsgId(null)}
                                            title={currentMsg || ''}
                                        ></span>
                                        <div className="env-info">
                                            <strong>{env.name}</strong>
                                            {!!env.is_local && <span className="tag locked" style={{ marginLeft: '8px', fontSize: '10px', padding: '2px 6px' }}>本机 (部署服务)</span>}
                                            <span className="detail">{env.username}@{env.host}:{env.port}</span>
                                        </div>
                                        <div className="env-actions">
                                            <button
                                                type="button"
                                                className={`icon-btn test-btn ${currentStatus === 'testing' ? 'testing' : (currentStatus === 'success' || currentStatus === 'error' ? currentStatus : '')}`}
                                                onClick={() => handleTestConnection(env)}
                                                disabled={testingEnvId === env.id}
                                                title="测试连接"
                                            >
                                                {testingEnvId === env.id ? '⌛' : '🔌'}
                                            </button>
                                            <button
                                                type="button"
                                                className={`icon-btn ${env.is_local ? 'active' : ''}`}
                                                onClick={() => handleSetLocal(env)}
                                                title={env.is_local ? "这是部署服务器 (本机)" : "设为部署服务器 (本机)"}
                                                style={{ color: env.is_local ? '#646cff' : undefined }}
                                            >
                                                🏠
                                            </button>
                                            <button type="button" className="icon-btn" onClick={() => openEditEnv(env)}>✏️</button>
                                            <button type="button" className="icon-btn danger" onClick={() => setShowDeleteConfirm({ type: 'environments', id: env.id, name: env.name })}>🗑️</button>
                                        </div>
                                        {visibleMsgId === env.id && currentMsg && (
                                            <div className={`test-inline-feedback ${activeResult ? (activeResult.success ? 'success' : 'error') : (persistedStatus === 'success' ? 'success' : 'error')}`}>
                                                {currentMsg}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        {environments.length === 0 && <p className="empty-text">暂无服务器配置</p>}
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div>
                        <div className="header-actions">
                            <h2>项目配置管理</h2>
                            <button type="button" className="btn-primary" onClick={handleAddProject}>+ 新增项目</button>
                        </div>

                        <div className="project-list">
                            {projects.map(project => {
                                const isExpanded = !!expandedProjects[project.id];
                                return (
                                    <div key={project.id} className="project-card card">
                                        <div className="project-info">
                                            <div className="title-row">
                                                <div
                                                    style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}
                                                    onClick={() => toggleProject(project.id)}
                                                    className="project-title-clickable"
                                                >
                                                    <div
                                                        style={{
                                                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                            transition: 'transform 0.2s',
                                                            fontSize: '12px',
                                                            color: '#64748b',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            background: '#f1f5f9',
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%'
                                                        }}
                                                    >
                                                        ▶
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <h3 style={{ margin: 0 }}>{project.name}</h3>
                                                        <span style={{ fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '2px 8px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                            {project.modules.length} 个模块
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="project-actions">
                                                    <button type="button" className="btn-dashed small" onClick={() => handleAddModule(project.id)}>+ 添加模块</button>
                                                    <button type="button" className="icon-btn" onClick={() => openEditProject(project)}>✏️</button>
                                                    <button type="button" className="icon-btn danger" onClick={() => setShowDeleteConfirm({ type: 'projects', id: project.id, name: project.name })}>🗑️</button>
                                                </div>
                                            </div>
                                            {project.base_path && <div className="path-label">📂 {project.base_path}</div>}
                                            <p>{project.description || '暂无描述'}</p>
                                        </div>

                                        {isExpanded && (
                                            <div className="module-section">
                                                {project.modules.length > 0 ? (
                                                    <table className="mini-table">
                                                        <thead><tr><th>模块名</th><th>类型</th><th>限制文件</th><th>远程路径</th><th>操作</th></tr></thead>
                                                        <tbody>
                                                            {project.modules.map((module) => (
                                                                <tr key={module.id}>
                                                                    <td>{module.name}</td>
                                                                    <td><span className="type-tag">{module.type}</span></td>
                                                                    <td><code>{module.allowed_files || '无限制'}</code></td>
                                                                    <td><code>{module.remote_path}</code></td>
                                                                    <td>
                                                                        <button type="button" className="text-btn" onClick={() => openEditModule(module, project.id)}>编辑</button>
                                                                        <button type="button" className="text-btn danger" onClick={() => setShowDeleteConfirm({ type: 'modules', id: module.id, name: module.name })}>删除</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                ) : (
                                                    <p className="empty-text">暂无模块，请先添加</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {projects.length === 0 && <div className="card empty-card">尚无项目，请点击上方按钮新增</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Env Config Modal */}
            {showEnvConfigModal && (
                <div className="modal-overlay">
                    <div className="modal-content wide" onClick={e => e.stopPropagation()}>
                        <div className="header-actions">
                            <h3>模块服务器特定配置: {editingModule?.name}</h3>
                            <button type="button" className="btn-dashed small" onClick={handleAddEnvConfig}>+ 新增服务器配置</button>
                        </div>

                        <div className="config-list">
                            <table className="mini-table">
                                <thead>
                                    <tr>
                                        <th>服务器</th>
                                        <th>远端路径</th>
                                        <th>重启命令</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {moduleEnvConfigs.map(cfg => (
                                        <tr key={cfg.id}>
                                            <td><b>{cfg.environment_name}</b></td>
                                            <td><code>{cfg.remote_path}</code></td>
                                            <td><small>{cfg.restart_command || cfg.start_command || '-'}</small></td>
                                            <td>
                                                <button type="button" className="text-btn" onClick={() => openEditEnvConfig(cfg)}>编辑</button>
                                                <button type="button" className="text-btn danger" onClick={() => handleDeleteEnvConfig(cfg.id)}>删除</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {moduleEnvConfigs.length === 0 && (
                                        <tr><td colSpan={5} className="empty-text" style={{ textAlign: 'center', padding: '20px' }}>未配置特定服务器，将使用模块默认配置</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-actions" style={{ marginTop: '24px' }}>
                            <button type="button" className="btn-secondary" onClick={() => setShowEnvConfigModal(false)}>关闭</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Env Config Form Modal */}
            {showEnvConfigFormModal && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{editingEnvConfig ? '编辑服务器配置' : '新增服务器配置'}</h3>
                        <form onSubmit={handleSaveEnvConfig}>
                            <div className="form-group">
                                <label>选择服务器</label>
                                <select
                                    required
                                    disabled={!!editingEnvConfig}
                                    value={envConfigForm.environment_id}
                                    onChange={e => setEnvConfigForm({ ...envConfigForm, environment_id: parseInt(e.target.value) })}
                                >
                                    <option value="">-- 请选择 --</option>
                                    {environments.map(env => (
                                        <option key={env.id} value={env.id}>{env.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label>
                                    远端部署路径
                                    {activeProjectId && projects.find(p => p.id === activeProjectId)?.base_path && (
                                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginLeft: '8px' }}>
                                            (基于项目根路径拼接)
                                        </span>
                                    )}
                                </label>
                                <div className="path-input-container">
                                    <input required value={envConfigForm.remote_path} onChange={e => setEnvConfigForm({ ...envConfigForm, remote_path: e.target.value })} placeholder="例如：gateway" />
                                    {activeProjectId && projects.find(p => p.id === activeProjectId)?.base_path && envConfigForm.remote_path.startsWith(projects.find(p => p.id === activeProjectId)?.base_path || '---') && (
                                        <button
                                            type="button"
                                            className="strip-path-btn"
                                            title="剥离重复的根路径"
                                            onClick={() => {
                                                const root = projects.find(p => p.id === activeProjectId)?.base_path || '';
                                                let newPath = envConfigForm.remote_path.replace(root, '');
                                                if (newPath.startsWith('/')) newPath = newPath.substring(1);
                                                setEnvConfigForm({ ...envConfigForm, remote_path: newPath });
                                            }}
                                        >
                                            ✂️ 优化
                                        </button>
                                    )}
                                </div>
                                {activeProjectId && projects.find(p => p.id === activeProjectId)?.base_path && (
                                    <div className="path-preview">
                                        最终路径: <code>{projects.find(p => p.id === activeProjectId)?.base_path}/{envConfigForm.remote_path.startsWith('/') ? envConfigForm.remote_path.substring(1) : envConfigForm.remote_path}</code>
                                    </div>
                                )}
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label>启动命令</label>
                                    <input value={envConfigForm.start_command} onChange={e => setEnvConfigForm({ ...envConfigForm, start_command: e.target.value })} placeholder="sh start.sh" />
                                </div>
                                <div className="form-group">
                                    <label>停止命令</label>
                                    <input value={envConfigForm.stop_command} onChange={e => setEnvConfigForm({ ...envConfigForm, stop_command: e.target.value })} placeholder="sh stop.sh" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>重启命令</label>
                                <input value={envConfigForm.restart_command} onChange={e => setEnvConfigForm({ ...envConfigForm, restart_command: e.target.value })} placeholder="sh restart.sh" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowEnvConfigFormModal(false)}>取消</button>
                                <button type="submit" className="btn-primary">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Project Modal */}
            {showProjectModal && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{editingProject ? '编辑项目' : '添加项目'}</h3>
                        <form onSubmit={handleSaveProject}>
                            <div className="form-group">
                                <label>项目名称</label>
                                <input required value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} placeholder="例如：电商系统" />
                            </div>
                            <div className="form-group">
                                <label>项目存放根路径</label>
                                <input value={projectForm.base_path} onChange={e => setProjectForm({ ...projectForm, base_path: e.target.value })} placeholder="例如：/opt/apps/my-project (可选)" />
                                <p className="hint">模块路径将基于此根路径进行拼接。</p>
                            </div>
                            <div className="form-group">
                                <label>项目描述</label>
                                <textarea value={projectForm.description} onChange={e => setProjectForm({ ...projectForm, description: e.target.value })} placeholder="项目的简要描述..." rows={3} />
                            </div>
                            <div className="form-group">
                                <label>服务器</label>
                                <select
                                    value={projectForm.environment_id}
                                    onChange={e => setProjectForm({ ...projectForm, environment_id: parseInt(e.target.value) })}
                                >
                                    <option value="0">-- 请选择服务器 --</option>
                                    {environments.map(env => (
                                        <option key={env.id} value={env.id}>{env.name} ({env.host})</option>
                                    ))}
                                </select>
                                <p className="hint">绑定后，该项目下所有模块将默认发布到此服务器。</p>
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowProjectModal(false)}>取消</button>
                                <button type="submit" className="btn-primary">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Environment Modal */}
            {showEnvModal && (
                <div className="modal-overlay" onClick={() => setShowEnvModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{editingEnv ? '编辑服务器' : '新增服务器'}</h3>
                        <form onSubmit={handleSaveEnv}>
                            <div className="form-group">
                                <label>服务器名称</label>
                                <input required value={envForm.name} onChange={e => setEnvForm({ ...envForm, name: e.target.value })} placeholder="例如：生产服务器" />
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label>主机地址</label>
                                    <input required value={envForm.host} onChange={e => setEnvForm({ ...envForm, host: e.target.value })} placeholder="IP 或 域名" />
                                </div>
                                <div className="form-group">
                                    <label>端口</label>
                                    <input type="number" value={envForm.port} onChange={e => setEnvForm({ ...envForm, port: parseInt(e.target.value) || 22 })} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>用户名</label>
                                <input required value={envForm.username} onChange={e => setEnvForm({ ...envForm, username: e.target.value })} placeholder="ssh 用户名" />
                            </div>
                            <div className="form-group">
                                <label>密码 {editingEnv && <span className="hint">(留空表示不修改)</span>}</label>
                                <input type="password" required={!editingEnv} value={envForm.password} onChange={e => setEnvForm({ ...envForm, password: e.target.value })} />
                            </div>

                            <div className="test-connection-section">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => handleTestConnection()}
                                    disabled={testingEnvId === 'new' || (editingEnv?.id === testingEnvId)}
                                >
                                    {testingEnvId === 'new' || (editingEnv && testingEnvId === editingEnv.id) ? '正在测试...' : '测试连接'}
                                </button>
                                {testResults[editingEnv?.id || 'new'] && (
                                    <span className={`test-feedback ${testResults[editingEnv?.id || 'new'].success ? 'success' : 'error'}`}>
                                        {testResults[editingEnv?.id || 'new'].success ? '✅' : '❌'} {testResults[editingEnv?.id || 'new'].message}
                                    </span>
                                )}
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowEnvModal(false)}>取消</button>
                                <button type="submit" className="btn-primary">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Module Modal */}
            {showModuleModal && (
                <div className="modal-overlay">
                    <div className="modal-content wide" onClick={e => e.stopPropagation()}>
                        <h3>{editingModule ? '编辑模块' : '添加模块'}</h3>
                        <form onSubmit={handleSaveModule}>
                            {/* Display current project base path */}
                            {activeProjectId && projects.find(p => p.id === activeProjectId)?.base_path && (
                                <div className="form-group">
                                    <label style={{ color: '#64748b' }}>项目根路径</label>
                                    <div style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '14px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                                        {projects.find(p => p.id === activeProjectId)?.base_path}
                                    </div>
                                </div>
                            )}
                            <div className="grid-2">
                                <div className="form-group">
                                    <label>模块名称</label>
                                    <input required value={moduleForm.name} onChange={e => setModuleForm({ ...moduleForm, name: e.target.value })} placeholder="例如：gateway" />
                                </div>
                                <div className="form-group">
                                    <label>类型</label>
                                    <select value={moduleForm.type} onChange={e => setModuleForm({ ...moduleForm, type: e.target.value })}>
                                        <option value="jar">Java JAR</option>
                                        <option value="zip">ZIP 压缩包</option>
                                        {/* <option value="static">静态资源</option> */}
                                    </select>

                                </div>
                            </div>

                            <div className="form-group">
                                <label>
                                    远端部署路径
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginLeft: '8px' }}>(基于项目根路径拼接)</span>
                                </label>
                                <div className="path-input-container">
                                    <input value={moduleForm.remote_path} onChange={e => setModuleForm({ ...moduleForm, remote_path: e.target.value })} placeholder="例如：gateway" />
                                    {activeProjectId && projects.find(p => p.id === activeProjectId)?.base_path && moduleForm.remote_path.startsWith(projects.find(p => p.id === activeProjectId)?.base_path || '---') && (
                                        <button
                                            type="button"
                                            className="strip-path-btn"
                                            title="剥离重复的根路径"
                                            onClick={() => {
                                                const root = projects.find(p => p.id === activeProjectId)?.base_path || '';
                                                let newPath = moduleForm.remote_path.replace(root, '');
                                                if (newPath.startsWith('/')) newPath = newPath.substring(1);
                                                setModuleForm({ ...moduleForm, remote_path: newPath });
                                            }}
                                        >
                                            ✂️ 优化
                                        </button>
                                    )}
                                </div>
                                {activeProjectId && projects.find(p => p.id === activeProjectId)?.base_path && (
                                    <div className="path-preview">
                                        最终路径: <code>{projects.find(p => p.id === activeProjectId)?.base_path}/{moduleForm.remote_path.startsWith('/') ? moduleForm.remote_path.substring(1) : moduleForm.remote_path}</code>
                                    </div>
                                )}
                            </div>

                            <div className="form-group">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ marginBottom: 0 }}>
                                        日志路径 (支持多个)
                                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginLeft: '8px' }}>(基于项目根路径拼接)</span>
                                    </label>
                                    <button
                                        type="button"
                                        className="btn-dashed small"
                                        onClick={() => {
                                            // Generate default: remote_path + "/logs/" + remote_path + ".log"
                                            let defaultLog = '';
                                            if (moduleForm.remote_path) {
                                                let rp = moduleForm.remote_path.trim();
                                                // Remove leading/trailing slashes and spaces
                                                rp = rp.replace(/^\/+|\/+$/g, '');

                                                const name = rp.split('/').pop() || 'app';
                                                // Combined logic: remote_path + /logs/ + name + .log
                                                defaultLog = `logs/${name}.log`;
                                            } else {
                                                defaultLog = 'logs/app.log';
                                            }
                                            setModuleForm({ ...moduleForm, log_paths: [...moduleForm.log_paths, defaultLog] });
                                        }}
                                    >
                                        + 添加
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {moduleForm.log_paths.map((path, index) => (
                                        <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <input
                                                    value={path}
                                                    onChange={e => {
                                                        const newPaths = [...moduleForm.log_paths];
                                                        newPaths[index] = e.target.value;
                                                        setModuleForm({ ...moduleForm, log_paths: newPaths });
                                                    }}
                                                    placeholder="logs/app.log"
                                                />
                                                <button
                                                    type="button"
                                                    className="btn-danger"
                                                    style={{ padding: '0 12px' }}
                                                    onClick={() => {
                                                        const newPaths = moduleForm.log_paths.filter((_, i) => i !== index);
                                                        setModuleForm({ ...moduleForm, log_paths: newPaths });
                                                    }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                            <div style={{
                                                fontSize: '12px',
                                                color: '#64748b',
                                                background: '#f1f5f9',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                marginTop: '2px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}>
                                                <span style={{ color: '#475569', fontWeight: 500 }}>最终路径:</span>
                                                <span style={{ fontFamily: 'monospace', color: '#059669', userSelect: 'all' }}>
                                                    {(() => {
                                                        const basePath = projects.find(p => p.id === activeProjectId)?.base_path || '';
                                                        const cleanBase = basePath.trim().replace(/\/+$/, '');
                                                        const cleanPath = path.trim().replace(/^\/+/, '');
                                                        return cleanBase && cleanPath ? `${cleanBase}/${cleanPath}` : (cleanBase || cleanPath);
                                                    })()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label>启动命令</label>
                                    <input value={moduleForm.start_command} onChange={e => setModuleForm({ ...moduleForm, start_command: e.target.value })} placeholder="sh start.sh" />
                                </div>
                                <div className="form-group">
                                    <label>停止命令</label>
                                    <input value={moduleForm.stop_command} onChange={e => setModuleForm({ ...moduleForm, stop_command: e.target.value })} placeholder="sh stop.sh" />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>重启命令</label>
                                <input value={moduleForm.restart_command} onChange={e => setModuleForm({ ...moduleForm, restart_command: e.target.value })} placeholder="sh restart.sh" />
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModuleModal(false)}>取消</button>
                                <button type="submit" className="btn-primary">保存</button>
                            </div>
                        </form>
                    </div >
                </div >
            )}


            {/* Delete Confirmation */}
            {
                showDeleteConfirm && (
                    <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
                        <div className="modal-content small" onClick={e => e.stopPropagation()}>
                            <h3>确认删除</h3>
                            <p>确定要删除 <strong>{showDeleteConfirm.name}</strong> 吗？此操作不可撤销。</p>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowDeleteConfirm(null)}>取消</button>
                                <button type="button" className="btn-danger" onClick={handleDelete}>删除</button>
                            </div>
                        </div>
                    </div>
                )
            }

            <style jsx>{`
        .config-layout { display: flex; gap: 24px; min-height: calc(100vh - 108px); }
        .config-sidebar { 
            width: 200px; 
            background: var(--bg-card); 
            backdrop-filter: var(--backdrop-blur);
            border-radius: 12px; 
            padding: 20px; 
            border: 1px solid var(--border-subtle);
            height: fit-content; 
        }
        .config-sidebar h3 { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.1em; }
        .config-nav { display: flex; flex-direction: column; gap: 4px; }
        .nav-item { 
            display: flex; align-items: center; gap: 10px; padding: 12px 16px; 
            border: 1px solid transparent; background: none; border-radius: 8px; 
            cursor: pointer; font-size: 14px; color: var(--text-secondary); 
            text-align: left; transition: all 0.2s; width: 100%; 
        }
        .nav-item:hover { background: rgba(99, 102, 241, 0.1); color: var(--text-primary); }
        .nav-item.active { 
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%);
            color: var(--accent-tertiary); 
            font-weight: 500;
            border-color: var(--border-subtle);
        }
        .nav-icon { font-size: 16px; }
        .config-content { flex: 1; }

        .section-card { 
            background: var(--bg-card); 
            backdrop-filter: var(--backdrop-blur);
            padding: 24px; 
            border-radius: 16px; 
            border: 1px solid var(--border-subtle);
        }
        .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .header-actions h2 { font-size: 18px; color: var(--text-primary); }
        
        .env-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .env-badge { 
            background: rgba(99, 102, 241, 0.05); 
            border: 1px solid var(--border-subtle); 
            padding: 12px 16px; 
            border-radius: 10px;
            display: flex; align-items: center; gap: 12px; min-width: 280px;
            position: relative;
            transition: all 0.2s;
        }
        .env-badge:hover {
            border-color: rgba(99, 102, 241, 0.4);
            background: rgba(99, 102, 241, 0.1);
        }
        .env-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .env-info strong { color: var(--text-primary); }
        .env-actions { display: flex; gap: 4px; }
        .dot { width: 8px; height: 8px; background: var(--text-muted); border-radius: 50%; flex-shrink: 0; transition: all 0.3s; }
        .dot.success { background: var(--success); box-shadow: 0 0 8px rgba(74, 222, 128, 0.4); }
        .dot.error { background: var(--error); box-shadow: 0 0 8px rgba(248, 113, 113, 0.4); }
        .dot.testing { background: var(--accent-primary); animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        .env-badge .detail { color: var(--text-muted); font-size: 12px; }
        .empty-text { color: var(--text-muted); font-size: 14px; }

        .project-list { display: flex; flex-direction: column; gap: 24px; }
        .project-card { 
            padding: 24px; 
            background: var(--bg-card); 
            backdrop-filter: var(--backdrop-blur);
            border-radius: 16px; 
            border: 1px solid var(--border-subtle);
            transition: all 0.2s;
        }
        .project-card:hover {
            border-color: rgba(99, 102, 241, 0.4);
        }
        .title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .title-row h3 { color: var(--text-primary); }
        .project-actions { display: flex; gap: 8px; align-items: center; }
        .project-info { border-bottom: 1px solid var(--border-light); padding-bottom: 16px; margin-bottom: 20px; }
        .project-details { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .path-label { 
            font-size: 13px; color: var(--accent-tertiary); background: rgba(34, 211, 238, 0.1); padding: 4px 10px; border-radius: 6px; 
            width: fit-content; font-family: monospace; border: 1px solid rgba(34, 211, 238, 0.2);
        }
        .project-info p { color: var(--text-muted); font-size: 14px; }
        
        .mini-table { width: 100%; border-collapse: collapse; }
        .mini-table th { text-align: left; padding: 12px; color: var(--text-muted); font-size: 12px; border-bottom: 1px solid var(--border-subtle); text-transform: uppercase; letter-spacing: 0.05em; }
        .mini-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid var(--border-light); color: var(--text-secondary); }
        .mini-table tr:hover td { background: rgba(99, 102, 241, 0.05); }
        .type-tag { background: rgba(99, 102, 241, 0.2); color: var(--accent-primary); padding: 3px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
        code { background: rgba(255, 255, 255, 0.05); color: var(--accent-tertiary); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; border: 1px solid var(--border-light); }
        .text-btn { color: var(--accent-primary); background: none; border: none; cursor: pointer; font-size: 13px; margin-right: 8px; transition: color 0.2s; }
        .text-btn:hover { color: var(--accent-tertiary); }
        .text-btn.danger { color: var(--error); }
        .text-btn.danger:hover { color: #fca5a5; }

        .icon-btn { background: none; border: none; cursor: pointer; font-size: 14px; padding: 6px; border-radius: 6px; color: var(--text-muted); transition: all 0.2s; }
        .icon-btn:hover { background: rgba(99, 102, 241, 0.1); color: var(--accent-primary); }
        .icon-btn.danger:hover { background: rgba(248, 113, 113, 0.1); color: var(--error); }

        .btn-primary { 
            background: var(--accent-gradient); 
            color: #fff; 
            border: none; 
            padding: 10px 20px; 
            border-radius: 8px; 
            font-weight: 600; 
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 5px 20px -5px rgba(99, 102, 241, 0.5);
        }
        .btn-secondary { 
            background: rgba(99, 102, 241, 0.1); 
            color: var(--text-secondary); 
            border: 1px solid var(--border-subtle); 
            padding: 10px 20px; 
            border-radius: 8px; 
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-secondary:hover { background: rgba(99, 102, 241, 0.2); color: var(--text-primary); }
        .btn-danger { 
            background: rgba(248, 113, 113, 0.2); 
            color: var(--error); 
            border: 1px solid rgba(248, 113, 113, 0.3); 
            padding: 10px 20px; 
            border-radius: 8px; 
            font-weight: 600; 
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-danger:hover { background: rgba(248, 113, 113, 0.3); }
        .btn-dashed { 
            border: 1px dashed var(--border-subtle); 
            background: none; 
            color: var(--text-muted); 
            padding: 6px 12px; 
            border-radius: 6px; 
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-dashed.small { font-size: 12px; }
        .btn-dashed:hover { border-color: var(--accent-primary); color: var(--accent-primary); }

        .modal-overlay { 
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: rgba(0,0,0,0.7); 
            backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center; z-index: 2000; 
        }
        .modal-content { 
            background: var(--bg-card-solid); 
            border: 1px solid var(--border-subtle);
            padding: 32px; 
            border-radius: 16px; 
            width: 100%; 
            max-width: 480px;
            position: relative;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), var(--shadow-glow);
        }
        .modal-content::before {
            content: '';
            position: absolute;
            top: 0;
            left: 20%;
            right: 20%;
            height: 2px;
            background: linear-gradient(90deg, transparent, var(--accent-primary), var(--accent-tertiary), var(--accent-primary), transparent);
        }
        .modal-content.wide { max-width: 640px; }
        .modal-content.small { max-width: 400px; }
        .modal-content h3 { margin-bottom: 24px; font-size: 20px; color: var(--text-primary); }
        .modal-content p { color: var(--text-muted); margin-bottom: 24px; }
        .config-list { margin-top: 16px; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: var(--text-secondary); }
        .form-group .hint { font-weight: normal; color: var(--text-muted); font-size: 12px; }
        .form-group input, .form-group textarea, .form-group select { 
            width: 100%; 
            padding: 12px; 
            background: var(--bg-input);
            border: 1px solid var(--border-subtle); 
            border-radius: 8px;
            color: var(--text-primary);
            transition: all 0.2s;
        }
        .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
            border-color: var(--accent-primary);
            box-shadow: var(--shadow-glow);
            outline: none;
        }
        .form-group input::placeholder, .form-group textarea::placeholder { color: var(--text-muted); }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; }
        
        .empty-card { text-align: center; padding: 48px; color: var(--text-muted); border: 2px dashed var(--border-subtle); background: none; }
        .loading { text-align: center; padding: 48px; color: var(--text-muted); }
        
        .test-inline-feedback {
            position: absolute;
            bottom: -38px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.95);
            color: #fff;
            padding: 8px 14px;
            border-radius: 8px;
            font-size: 12px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
            z-index: 100;
            white-space: nowrap;
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            animation: slideUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        .test-inline-feedback.success { background: rgba(74, 222, 128, 0.95); }
        .test-inline-feedback.error { background: rgba(248, 113, 113, 0.95); }

        .test-connection-section {
            margin: 20px 0;
            padding: 15px;
            background: rgba(99, 102, 241, 0.05);
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .test-feedback.success { color: var(--success); }
        .test-feedback.error { color: var(--error); }

        .path-input-container { position: relative; display: flex; align-items: center; }
        .strip-path-btn {
            position: absolute;
            right: 8px;
            padding: 4px 8px;
            background: rgba(99, 102, 241, 0.1);
            border: 1px solid var(--border-subtle);
            border-radius: 4px;
            font-size: 11px;
            color: var(--accent-primary);
            cursor: pointer;
            transition: all 0.2s;
        }
        .strip-path-btn:hover { background: rgba(99, 102, 241, 0.2); border-color: var(--accent-primary); }
        .path-preview {
            margin-top: 8px;
            padding: 8px 12px;
            background: rgba(99, 102, 241, 0.05);
            border-radius: 6px;
            font-size: 12px;
            color: var(--text-muted);
            border: 1px solid var(--border-subtle);
        }
        .path-preview code { color: var(--success); font-weight: 600; background: transparent; border: none; }
      `}</style>
        </div >
    );
}
