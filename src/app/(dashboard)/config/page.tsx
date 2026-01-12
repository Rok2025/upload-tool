'use client';

import { useState, useEffect } from 'react';

interface Environment {
    id: number;
    name: string;
    host: string;
    port: number;
    username: string;
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
    const [activeTab, setActiveTab] = useState<TabType>('environments');

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
    const [envForm, setEnvForm] = useState({ name: '', host: '', port: 22, username: '', password: '' });
    const [moduleForm, setModuleForm] = useState({ name: '', type: 'jar', remote_path: '', log_path: '', start_command: '', stop_command: '', restart_command: '', backup_path: '' });
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
    const resetEnvForm = () => { setEnvForm({ name: '', host: '', port: 22, username: '', password: '' }); setEditingEnv(null); };
    const resetModuleForm = () => { setModuleForm({ name: '', type: 'jar', remote_path: '', log_path: '', start_command: '', stop_command: '', restart_command: '', backup_path: '' }); setEditingModule(null); };

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
        setEnvForm({ name: e.name, host: e.host, port: e.port, username: e.username, password: '' });
        setShowEnvModal(true);
    };

    const openEditModule = (m: Module, projectId: number) => {
        setEditingModule(m);
        setActiveProjectId(projectId);
        setModuleForm({ name: m.name, type: m.type, remote_path: m.remote_path, log_path: m.log_path || '', start_command: m.start_command || '', stop_command: m.stop_command || '', restart_command: m.restart_command || '', backup_path: '' });
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
        const body = editingModule ? { ...moduleForm, id: editingModule.id } : { ...moduleForm, project_id: activeProjectId };
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
        if (!confirm('确定要删除此环境配置吗？')) return;
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
                            <button type="button" className="btn-primary" onClick={handleAddEnv}>+ 新增环境</button>
                        </div>
                        <div className="env-grid">
                            {environments.map(env => {
                                const activeResult = testResults[env.id];
                                const persistedStatus = env.last_test_status;
                                const currentStatus = testingEnvId === env.id ? 'testing' : (activeResult ? (activeResult.success ? 'success' : 'error') : persistedStatus);
                                const currentMsg = activeResult ? activeResult.message : (persistedStatus ? env.last_test_message : '');

                                return (
                                    <div key={env.id} className="env-badge">
                                        <span
                                            className={`dot ${currentStatus}`}
                                            onMouseEnter={() => setVisibleMsgId(env.id)}
                                            onMouseLeave={() => setVisibleMsgId(null)}
                                            title={currentMsg || ''}
                                        ></span>
                                        <div className="env-info">
                                            <strong>{env.name}</strong>
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
                            {environments.length === 0 && <p className="empty-text">暂无环境配置</p>}
                        </div>
                    </div>
                )}

                {activeTab === 'projects' && (
                    <div>
                        <div className="header-actions">
                            <h2>项目配置管理</h2>
                            <button type="button" className="btn-primary" onClick={handleAddProject}>+ 新增项目</button>
                        </div>

                        <div className="project-list">
                            {projects.map(project => (
                                <div key={project.id} className="project-card card">
                                    <div className="project-info">
                                        <div className="title-row">
                                            <h3>{project.name}</h3>
                                            <div className="project-actions">
                                                <button type="button" className="btn-dashed small" onClick={() => handleAddModule(project.id)}>+ 添加模块</button>
                                                <button type="button" className="icon-btn" onClick={() => openEditProject(project)}>✏️</button>
                                                <button type="button" className="icon-btn danger" onClick={() => setShowDeleteConfirm({ type: 'projects', id: project.id, name: project.name })}>🗑️</button>
                                            </div>
                                        </div>
                                        {project.base_path && <div className="path-label">📂 {project.base_path}</div>}
                                        <p>{project.description || '暂无描述'}</p>
                                    </div>

                                    <div className="module-section">
                                        {project.modules.length > 0 ? (
                                            <table className="mini-table">
                                                <thead><tr><th>模块名</th><th>类型</th><th>远程路径</th><th>操作</th></tr></thead>
                                                <tbody>
                                                    {project.modules.map((module) => (
                                                        <tr key={module.id}>
                                                            <td>{module.name}</td>
                                                            <td><span className="type-tag">{module.type}</span></td>
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
                                </div>
                            ))}
                            {projects.length === 0 && <div className="card empty-card">尚无项目，请点击上方按钮新增</div>}
                        </div>
                    </div>
                )}
            </div>

            {/* Env Config Modal */}
            {showEnvConfigModal && (
                <div className="modal-overlay" onClick={() => setShowEnvConfigModal(false)}>
                    <div className="modal-content wide" onClick={e => e.stopPropagation()}>
                        <div className="header-actions">
                            <h3>模块环境特定配置: {editingModule?.name}</h3>
                            <button type="button" className="btn-dashed small" onClick={handleAddEnvConfig}>+ 新增环境配置</button>
                        </div>

                        <div className="config-list">
                            <table className="mini-table">
                                <thead>
                                    <tr>
                                        <th>环境</th>
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
                                        <tr><td colSpan={5} className="empty-text" style={{ textAlign: 'center', padding: '20px' }}>未配置特定环境，将使用模块默认配置</td></tr>
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
                <div className="modal-overlay" onClick={() => setShowEnvConfigFormModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{editingEnvConfig ? '编辑环境配置' : '新增环境配置'}</h3>
                        <form onSubmit={handleSaveEnvConfig}>
                            <div className="form-group">
                                <label>选择环境</label>
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
                <div className="modal-overlay" onClick={() => setShowProjectModal(false)}>
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
                                <label>部署环境 (服务器)</label>
                                <select
                                    value={projectForm.environment_id}
                                    onChange={e => setProjectForm({ ...projectForm, environment_id: parseInt(e.target.value) })}
                                >
                                    <option value="0">-- 请选择部署环境 --</option>
                                    {environments.map(env => (
                                        <option key={env.id} value={env.id}>{env.name} ({env.host})</option>
                                    ))}
                                </select>
                                <p className="hint">绑定后，该项目下所有模块将默认发布到此环境。</p>
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
                        <h3>{editingEnv ? '编辑环境' : '新增环境'}</h3>
                        <form onSubmit={handleSaveEnv}>
                            <div className="form-group">
                                <label>环境名称</label>
                                <input required value={envForm.name} onChange={e => setEnvForm({ ...envForm, name: e.target.value })} placeholder="例如：生产环境" />
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
                <div className="modal-overlay" onClick={() => setShowModuleModal(false)}>
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
                                        <option value="static">静态资源</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label>
                                    远端部署路径
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'normal', marginLeft: '8px' }}>(基于项目根路径拼接)</span>
                                </label>
                                <div className="path-input-container">
                                    <input required value={moduleForm.remote_path} onChange={e => setModuleForm({ ...moduleForm, remote_path: e.target.value })} placeholder="例如：gateway" />
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
                                <label>日志路径</label>
                                <input value={moduleForm.log_path} onChange={e => setModuleForm({ ...moduleForm, log_path: e.target.value })} placeholder="/var/log/my-app.log" />
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
                    </div>
                </div>
            )}

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
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
            )}

            <style jsx>{`
        .config-layout { display: flex; gap: 24px; min-height: calc(100vh - 108px); }
        .config-sidebar { width: 200px; background: #fff; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); height: fit-content; }
        .config-sidebar h3 { font-size: 14px; color: #64748b; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }
        .config-nav { display: flex; flex-direction: column; gap: 4px; }
        .nav-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border: none; background: none; border-radius: 8px; cursor: pointer; font-size: 14px; color: #64748b; text-align: left; transition: all 0.2s; width: 100%; }
        .nav-item:hover { background: #f8fafc; color: #1e293b; }
        .nav-item.active { background: #eff6ff; color: #2563eb; font-weight: 500; }
        .nav-icon { font-size: 16px; }
        .config-content { flex: 1; }

        .section-card { background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .header-actions h2 { font-size: 18px; color: #1e293b; }
        
        .env-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .env-badge { 
            background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 8px;
            display: flex; align-items: center; gap: 12px; min-width: 280px;
            position: relative;
        }
        .env-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .env-actions { display: flex; gap: 4px; }
        .dot { width: 8px; height: 8px; background: #cbd5e1; border-radius: 50%; flex-shrink: 0; transition: all 0.3s; }
        .dot.success { background: #10b981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
        .dot.error { background: #ef4444; box-shadow: 0 0 8px rgba(239, 68, 68, 0.4); }
        .dot.testing { background: #2563eb; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }
        .env-badge .detail { color: #64748b; font-size: 12px; }
        .empty-text { color: #94a3b8; font-size: 14px; }

        .project-list { display: flex; flex-direction: column; gap: 24px; }
        .project-card { padding: 24px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .project-actions { display: flex; gap: 8px; align-items: center; }
        .project-info { border-bottom: 1px solid #f1f5f9; padding-bottom: 16px; margin-bottom: 20px; }
        .project-details { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .path-label { 
            font-size: 13px; color: #475569; background: #f1f5f9; padding: 4px 10px; border-radius: 6px; 
            width: fit-content; font-family: monospace; border: 1px solid #e2e8f0;
        }
        .project-info p { color: #64748b; font-size: 14px; }
        
        .mini-table { width: 100%; border-collapse: collapse; }
        .mini-table th { text-align: left; padding: 12px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid #f1f5f9; }
        .mini-table td { padding: 12px; font-size: 14px; border-bottom: 1px solid #f8fafc; }
        .type-tag { background: #eff6ff; color: #2563eb; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; }
        .text-btn { color: #2563eb; background: none; border: none; cursor: pointer; font-size: 13px; margin-right: 8px; }
        .text-btn.danger { color: #ef4444; }

        .icon-btn { background: none; border: none; cursor: pointer; font-size: 14px; padding: 4px; border-radius: 4px; }
        .icon-btn:hover { background: #f1f5f9; }
        .icon-btn.danger:hover { background: #fef2f2; }

        .btn-primary { background: #2563eb; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .btn-secondary { background: #f1f5f9; color: #475569; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; }
        .btn-danger { background: #ef4444; color: #fff; border: none; padding: 8px 20px; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .btn-dashed { border: 1px dashed #cbd5e1; background: none; color: #64748b; padding: 6px 12px; border-radius: 6px; cursor: pointer; }
        .btn-dashed.small { font-size: 12px; }
        .btn-dashed:hover { border-color: #2563eb; color: #2563eb; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; }
        .modal-content { background: #fff; padding: 32px; border-radius: 12px; width: 100%; max-width: 480px; }
        .modal-content.wide { max-width: 640px; }
        .modal-content.small { max-width: 400px; }
        .modal-content h3 { margin-bottom: 24px; font-size: 20px; }
        .modal-content p { color: #64748b; margin-bottom: 24px; }
        .config-list { margin-top: 16px; border: 1px solid #f1f5f9; border-radius: 8px; overflow: hidden; }
        .form-group { margin-bottom: 20px; }
        .form-group label { display: block; margin-bottom: 8px; font-size: 14px; font-weight: 500; color: #475569; }
        .form-group .hint { font-weight: normal; color: #94a3b8; font-size: 12px; }
        .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 32px; }
        
        .empty-card { text-align: center; padding: 48px; color: #94a3b8; border: 2px dashed #f1f5f9; background: none; box-shadow: none; }
        .loading { text-align: center; padding: 48px; color: #64748b; }
        
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
        .test-inline-feedback.success { background: rgba(16, 185, 129, 0.95); }
        .test-inline-feedback.error { background: rgba(239, 68, 68, 0.95); }

        .test-connection-section {
            margin: 20px 0;
            padding: 15px;
            background: #f8fafc;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .test-feedback.success { color: #10b981; }
        .test-feedback.error { color: #ef4444; }

        .path-input-container { position: relative; display: flex; align-items: center; }
        .path-input-container input { padding-right: 70px !important; }
        .strip-path-btn {
            position: absolute;
            right: 8px;
            padding: 4px 8px;
            background: #fff;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            font-size: 11px;
            color: #2563eb;
            cursor: pointer;
            transition: all 0.2s;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .strip-path-btn:hover { background: #f1f5f9; border-color: #cbd5e1; color: #1d4ed8; }
        .path-preview {
            margin-top: 8px;
            padding: 8px 12px;
            background: #f8fafc;
            border-radius: 6px;
            font-size: 12px;
            color: #64748b;
            border: 1px solid #e2e8f0;
        }
        .path-preview code { color: #059669; font-weight: 600; }
      `}</style>
        </div>
    );
}
