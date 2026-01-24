'use client';

import { useState, useEffect, useRef } from 'react';

interface Project {
    id: number;
    name: string;
    modules: Module[];
}

interface Module {
    id: number;
    name: string;
    log_path: string;
}

interface Environment {
    id: number;
    name: string;
}

export default function LogPage() {
    // Data
    const [projects, setProjects] = useState<Project[]>([]);
    const [environments, setEnvironments] = useState<Environment[]>([]);
    const [modules, setModules] = useState<Module[]>([]);

    // Selection
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');
    const [selectedModuleId, setSelectedModuleId] = useState<string>('');
    const [selectedEnvId, setSelectedEnvId] = useState<string>('');
    const [availableLogPaths, setAvailableLogPaths] = useState<string[]>([]);
    const [selectedLogPath, setSelectedLogPath] = useState<string>('');

    // Log state
    const [logs, setLogs] = useState<string[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');

    const scrollRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Fetch initial data
    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [projRes, envRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/environments')
            ]);

            if (projRes.ok) {
                const projectsData = await projRes.json();
                setProjects(projectsData);
            }

            if (envRes.ok) {
                const envsData = await envRes.json();
                setEnvironments(envsData);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
        }
    };

    // Update modules when project changes
    useEffect(() => {
        if (selectedProjectId) {
            const project = projects.find(p => p.id === parseInt(selectedProjectId));
            if (project) {
                setModules(project.modules || []);
                setSelectedModuleId(''); // Reset module selection
            }
        } else {
            setModules([]);
            setSelectedModuleId('');
        }
    }, [selectedProjectId, projects]);

    // Parse log paths when module selected
    useEffect(() => {
        if (selectedModuleId) {
            const module = modules.find(m => m.id === parseInt(selectedModuleId));
            if (module) {
                let paths: string[] = [];
                if (module.log_path) {
                    try {
                        const parsed = JSON.parse(module.log_path);
                        if (Array.isArray(parsed)) paths = parsed;
                        else paths = [module.log_path];
                    } catch (e) {
                        paths = [module.log_path];
                    }
                }
                setAvailableLogPaths(paths);
                if (paths.length > 0) setSelectedLogPath(paths[0]);
                else setSelectedLogPath('');
            }
        } else {
            setAvailableLogPaths([]);
            setSelectedLogPath('');
        }
    }, [selectedModuleId, modules]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const startStreaming = () => {
        if (!selectedModuleId || !selectedEnvId) {
            setLogs(['[ERROR] 请先选择模块和环境']);
            return;
        }

        // Check if module has log_path configured
        const module = modules.find(m => m.id === parseInt(selectedModuleId));
        let hasLogs = false;
        if (module?.log_path) {
            try {
                const p = JSON.parse(module.log_path);
                if (Array.isArray(p) ? p.length > 0 : !!p) hasLogs = true;
            } catch { hasLogs = !!module.log_path; }
        }

        if (!hasLogs) {
            setLogs(['[ERROR] 该模块未配置日志路径']);
            return;
        }

        const currentLogPath = selectedLogPath;
        setLogs([`[SYSTEM] 正在连接到日志流... (${currentLogPath || '默认'})`]);
        setConnectionStatus('connecting');
        setIsStreaming(true);

        const url = `/api/logs?moduleId=${selectedModuleId}&environmentId=${selectedEnvId}${currentLogPath ? `&logPath=${encodeURIComponent(currentLogPath)}` : ''}`;
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
            setConnectionStatus('connected');
            setLogs(prev => [...prev, `[SYSTEM] 已连接，等待日志输出...`]);
        };

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.content) {
                setLogs(prev => [...prev.slice(-1000), data.content]);
            } else if (data.error) {
                setLogs(prev => [...prev, `[ERROR] ${data.error}`]);
                setConnectionStatus('error');
                stopStreaming();
            }
        };

        eventSource.onerror = () => {
            setLogs(prev => [...prev, '[SYSTEM] 连接已断开']);
            setConnectionStatus('error');
            stopStreaming();
        };
    };

    const stopStreaming = () => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }
        setIsStreaming(false);
        if (connectionStatus !== 'error') {
            setConnectionStatus('idle');
        }
    };

    const clearLogs = () => {
        setLogs([]);
    };

    const getStatusColor = () => {
        switch (connectionStatus) {
            case 'connecting': return 'var(--warning)';
            case 'connected': return 'var(--success)';
            case 'error': return 'var(--error)';
            default: return 'var(--text-muted)';
        }
    };

    const getStatusText = () => {
        switch (connectionStatus) {
            case 'connecting': return '连接中...';
            case 'connected': return '已连接';
            case 'error': return '连接失败';
            default: return '未连接';
        }
    };

    return (
        <div className="log-container">
            <div className="log-header">
                <h2>实时运行日志</h2>
                <div className="status-indicator">
                    <span className="status-dot" style={{ background: getStatusColor() }}></span>
                    <span className="status-text">{getStatusText()}</span>
                </div>
            </div>

            <div className="log-controls">
                <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={isStreaming}
                >
                    <option value="">选择项目</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                <select
                    value={selectedModuleId}
                    onChange={(e) => setSelectedModuleId(e.target.value)}
                    disabled={isStreaming || !selectedProjectId}
                >
                    <option value="">选择模块</option>
                    {modules
                        .filter(m => {
                            if (!m.log_path) return false;
                            try {
                                const p = JSON.parse(m.log_path);
                                return Array.isArray(p) ? p.length > 0 : !!p;
                            } catch { return !!m.log_path; }
                        })
                        .map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                </select>

                <select
                    value={selectedEnvId}
                    onChange={(e) => setSelectedEnvId(e.target.value)}
                    disabled={isStreaming}
                >
                    <option value="">选择环境</option>
                    {environments.map(e => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>

                {availableLogPaths.length > 0 && (
                    <div className="radio-group">
                        {availableLogPaths.map((path, idx) => (
                            <label key={idx} className={`radio-label ${selectedLogPath === path ? 'active' : ''}`}>
                                <input
                                    type="radio"
                                    name="logPath"
                                    value={path}
                                    checked={selectedLogPath === path}
                                    onChange={(e) => setSelectedLogPath(e.target.value)}
                                    disabled={isStreaming}
                                />
                                <span className="path-text">{path}</span>
                            </label>
                        ))}
                    </div>
                )}

                <div className="button-group">
                    {!isStreaming ? (
                        <button
                            className="btn-primary"
                            onClick={startStreaming}
                            disabled={!selectedModuleId || !selectedEnvId}
                        >
                            开始监控
                        </button>
                    ) : (
                        <button className="btn-danger" onClick={stopStreaming}>
                            停止监控
                        </button>
                    )}
                    <button className="btn-secondary" onClick={clearLogs}>
                        清空日志
                    </button>
                </div>
            </div>

            <div className="log-viewport" ref={scrollRef}>
                {logs.length === 0 ? (
                    <div className="log-empty">请选择模块和环境后点击"开始监控"</div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className="log-line">{log}</div>
                    ))
                )}
            </div>

            <style jsx>{`
        .log-container { 
            background: var(--bg-card); 
            backdrop-filter: var(--backdrop-blur);
            color: var(--accent-tertiary); 
            border-radius: 16px; 
            height: 85vh; 
            display: flex; 
            flex-direction: column; 
            overflow: hidden;
            box-shadow: var(--shadow-glow);
            border: 1px solid var(--border-subtle);
            position: relative;
        }
        .log-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-tertiary), var(--accent-primary));
            animation: scanline 3s linear infinite;
        }
        [data-theme="light"] .log-container::before {
            display: none;
        }
        @keyframes scanline {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
        }
        .log-header { 
            padding: 16px 24px; 
            border-bottom: 1px solid var(--border-subtle); 
            display: flex; 
            justify-content: space-between; 
            align-items: center;
            background: var(--bg-card);
        }
        [data-theme="dark"] .log-header {
            background: rgba(15, 23, 42, 0.5);
        }
        .log-header h2 { 
            font-size: 18px; 
            color: var(--text-primary); 
            margin: 0;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        [data-theme="dark"] .log-header h2::before {
            content: '>';
            color: var(--accent-tertiary);
            font-family: 'Courier New', monospace;
            animation: blink 1s infinite;
        }
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
        
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 12px;
            background: var(--bg-input);
            border-radius: 20px;
            border: 1px solid var(--border-subtle);
        }
        [data-theme="dark"] .status-indicator {
            background: rgba(30, 41, 59, 0.5);
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: pulse 2s infinite;
            box-shadow: 0 0 8px currentColor;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.9); }
        }
        .status-text {
            font-size: 13px;
            color: var(--text-secondary);
            font-family: 'Courier New', monospace;
        }

        .log-controls {
            padding: 16px 24px;
            border-bottom: 1px solid var(--border-subtle);
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
            background: var(--bg-card);
        }
        [data-theme="dark"] .log-controls {
            background: rgba(15, 23, 42, 0.3);
        }
        .log-controls select {
            padding: 10px 14px;
            border-radius: 8px;
            border: 1px solid var(--border-subtle);
            background: var(--bg-input);
            color: var(--text-primary);
            font-size: 13px;
            min-width: 150px;
            transition: all 0.2s;
        }
        .log-controls select:hover:not(:disabled) {
            border-color: var(--accent-primary);
        }
        .log-controls select:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
            outline: none;
        }
        .log-controls select:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .radio-group {
            display: flex;
            gap: 12px;
            align-items: center;
            background: var(--bg-input);
            padding: 6px 14px;
            border-radius: 8px;
            border: 1px solid var(--border-subtle);
            flex-wrap: wrap;
        }
        .radio-label {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            font-size: 13px;
            color: var(--text-muted);
            transition: color 0.2s;
            font-family: 'Courier New', monospace;
        }
        .radio-label.active {
            color: var(--accent-tertiary);
            font-weight: 500;
        }
        .radio-label input {
            accent-color: var(--accent-tertiary);
        }

        .button-group {
            display: flex;
            gap: 8px;
            margin-left: auto;
        }
        .btn-primary, .btn-danger, .btn-secondary {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
            overflow: hidden;
        }
        .btn-primary {
            background: linear-gradient(135deg, var(--accent-tertiary), #06b6d4);
            color: #fff;
        }
        [data-theme="dark"] .btn-primary {
            color: var(--bg-primary);
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
        .btn-primary:hover:not(:disabled)::after {
            left: 100%;
        }
        .btn-primary:hover:not(:disabled) {
            box-shadow: 0 0 20px rgba(34, 211, 238, 0.4);
            transform: translateY(-1px);
        }
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-danger {
            background: linear-gradient(135deg, var(--error), #dc2626);
            color: #fff;
        }
        .btn-danger:hover {
            box-shadow: 0 0 20px rgba(248, 113, 113, 0.4);
            transform: translateY(-1px);
        }
        .btn-secondary {
            background: var(--bg-input);
            color: var(--text-secondary);
            border: 1px solid var(--border-subtle);
        }
        .btn-secondary:hover {
            border-color: var(--accent-primary);
            color: var(--text-primary);
        }
        [data-theme="dark"] .btn-secondary:hover {
            background: rgba(51, 65, 85, 0.8);
        }

        .log-viewport { 
            flex: 1; 
            padding: 20px; 
            font-family: 'Courier New', monospace; 
            font-size: 13px; 
            overflow-y: auto; 
            white-space: pre-wrap;
            line-height: 1.8;
            background: linear-gradient(180deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%);
        }
        .log-viewport::-webkit-scrollbar {
            width: 8px;
        }
        .log-viewport::-webkit-scrollbar-track {
            background: rgba(30, 41, 59, 0.3);
        }
        .log-viewport::-webkit-scrollbar-thumb {
            background: var(--border-subtle);
            border-radius: 4px;
        }
        .log-viewport::-webkit-scrollbar-thumb:hover {
            background: var(--accent-primary);
        }
        .log-empty {
            color: var(--text-muted);
            text-align: center;
            padding: 60px;
            font-size: 14px;
        }
        .log-line { 
            margin-bottom: 2px;
            word-wrap: break-word;
            padding: 2px 0;
            border-left: 2px solid transparent;
            padding-left: 10px;
            transition: all 0.2s;
        }
        .log-line:hover {
            background: rgba(34, 211, 238, 0.05);
            border-left-color: var(--accent-tertiary);
        }
      `}</style>
        </div>
    );
}
