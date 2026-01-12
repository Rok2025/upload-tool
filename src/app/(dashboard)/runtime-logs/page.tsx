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
        if (!module?.log_path) {
            setLogs(['[ERROR] 该模块未配置日志路径']);
            return;
        }

        setLogs([`[SYSTEM] 正在连接到日志流...`]);
        setConnectionStatus('connecting');
        setIsStreaming(true);

        const eventSource = new EventSource(`/api/logs?moduleId=${selectedModuleId}&environmentId=${selectedEnvId}`);
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
            case 'connecting': return '#fbbf24';
            case 'connected': return '#10b981';
            case 'error': return '#ef4444';
            default: return '#64748b';
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
                    {modules.map(m => (
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
            background: #0f172a; 
            color: #38bdf8; 
            border-radius: 12px; 
            height: 85vh; 
            display: flex; 
            flex-direction: column; 
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        }
        .log-header { 
            padding: 16px 24px; 
            border-bottom: 1px solid #1e293b; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
        }
        .log-header h2 { font-size: 18px; color: #f8fafc; margin: 0; }
        
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        .status-text {
            font-size: 13px;
            color: #cbd5e1;
        }

        .log-controls {
            padding: 16px 24px;
            border-bottom: 1px solid #1e293b;
            display: flex;
            gap: 12px;
            align-items: center;
            flex-wrap: wrap;
        }
        .log-controls select {
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #334155;
            background: #1e293b;
            color: #e2e8f0;
            font-size: 13px;
            min-width: 150px;
        }
        .log-controls select:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .button-group {
            display: flex;
            gap: 8px;
            margin-left: auto;
        }
        .btn-primary, .btn-danger, .btn-secondary {
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #38bdf8;
            color: #0f172a;
        }
        .btn-primary:hover:not(:disabled) {
            background: #22d3ee;
        }
        .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .btn-danger {
            background: #ef4444;
            color: #fff;
        }
        .btn-danger:hover {
            background: #dc2626;
        }
        .btn-secondary {
            background: #334155;
            color: #e2e8f0;
        }
        .btn-secondary:hover {
            background: #475569;
        }

        .log-viewport { 
            flex: 1; 
            padding: 20px; 
            font-family: 'Courier New', monospace; 
            font-size: 13px; 
            overflow-y: auto; 
            white-space: pre-wrap;
            line-height: 1.6;
        }
        .log-empty {
            color: #64748b;
            text-align: center;
            padding: 40px;
            font-size: 14px;
        }
        .log-line { 
            margin-bottom: 4px;
            word-wrap: break-word;
        }
      `}</style>
        </div>
    );
}
