'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface LogModalProps {
    moduleId: number;
    moduleName: string;
    environmentId: number | null;
    initialLogPaths?: string[];
    onClose: () => void;
}

export function LogModal({ moduleId, moduleName, environmentId, initialLogPaths = [], onClose }: LogModalProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [mounted, setMounted] = useState(false);

    // Log selection
    const [availableLogs, setAvailableLogs] = useState<string[]>(initialLogPaths);
    const [selectedLogPath, setSelectedLogPath] = useState<string>(initialLogPaths.length > 0 ? initialLogPaths[0] : '');

    const scrollRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    // Client-side only and auto-start
    useEffect(() => {
        setMounted(true);
        if (moduleId && environmentId) {
            // Small timeout to ensure the modal is smoothly rendered before starting stream
            const timer = setTimeout(() => {
                startStreaming();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [moduleId, environmentId]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopStreaming();
        };
    }, []);

    const startStreaming = () => {
        if (!environmentId) {
            setLogs(['[ERROR] 环境ID未指定']);
            return;
        }

        const currentLogPath = selectedLogPath;
        setLogs([`[SYSTEM] 正在连接到 ${moduleName} 的日志流... (${currentLogPath || '默认'})`]);
        setConnectionStatus('connecting');
        setIsStreaming(true);

        const url = `/api/logs?moduleId=${moduleId}&environmentId=${environmentId}${currentLogPath ? `&logPath=${encodeURIComponent(currentLogPath)}` : ''}`;
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

    if (!mounted) return null;

    const modalContent = (
        <div className="modal-overlay" onClick={onClose}>
            <div className="log-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <h3>实时运行日志 - {moduleName}</h3>
                            {availableLogs.length > 1 && (
                                <select
                                    className="log-selector"
                                    value={selectedLogPath}
                                    onChange={e => {
                                        setSelectedLogPath(e.target.value);
                                        // If streaming, restart? Or let user click start?
                                        // Better to stop first if streaming.
                                        if (isStreaming) {
                                            stopStreaming();
                                            // Optional: auto-restart logic could be here but button is safer
                                        }
                                        setLogs([]); // Clear logs on switch
                                    }}
                                    onClick={e => e.stopPropagation()}
                                >
                                    {availableLogs.map(path => (
                                        <option key={path} value={path}>{path}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="status-indicator">
                            <span className="status-dot" style={{ background: getStatusColor() }}></span>
                            <span className="status-text">{getStatusText()}</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="log-viewport" ref={scrollRef}>
                    {logs.length === 0 ? (
                        <div className="log-empty">点击"开始监控"查看实时日志</div>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} className="log-line">{log}</div>
                        ))
                    )}
                </div>

                <div className="modal-footer">
                    {!isStreaming ? (
                        <button className="btn-primary" onClick={startStreaming} disabled={!environmentId}>
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
                    <button className="btn-secondary" onClick={onClose}>
                        关闭
                    </button>
                </div>

                <style jsx global>{`
                    .modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 240px; /* Sidebar offset */
                        right: 0;
                        bottom: 0;
                        background: rgba(15, 23, 42, 0.8);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 100000;
                        backdrop-filter: blur(12px);
                        padding: 40px;
                        animation: fadeIn 0.3s ease;
                    }

                    .log-modal {
                        background: var(--bg-card);
                        backdrop-filter: var(--backdrop-blur);
                        border-radius: 16px;
                        width: 100%;
                        max-width: 1100px;
                        height: 85vh;
                        max-height: 850px;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 0 0 1px var(--border-subtle), 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                        overflow: hidden;
                        position: relative;
                        animation: modalShow 0.4s cubic-bezier(0, 0, 0.2, 1);
                        border: 1px solid var(--border-subtle);
                    }

                    .log-modal::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 2px;
                        background: linear-gradient(90deg, var(--accent-primary), var(--accent-tertiary), var(--accent-primary));
                        animation: scanline 3s linear infinite;
                    }

                    @keyframes scanline {
                        0% { opacity: 0.5; }
                        50% { opacity: 1; }
                        100% { opacity: 0.5; }
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    @keyframes modalShow {
                        from { opacity: 0; transform: scale(0.95) translateY(10px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }

                    .modal-header {
                        padding: 20px 24px;
                        border-bottom: 1px solid var(--border-subtle);
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        flex-shrink: 0;
                        background: rgba(15, 23, 42, 0.5);
                    }

                    .modal-header h3 {
                        font-size: 18px;
                        color: var(--text-primary);
                        margin: 0 0 8px 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }

                    .modal-header h3::before {
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
                        padding: 4px 10px;
                        background: rgba(30, 41, 59, 0.5);
                        border-radius: 16px;
                        border: 1px solid var(--border-subtle);
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

                    .close-btn {
                        background: none;
                        border: none;
                        color: var(--text-muted);
                        font-size: 24px;
                        cursor: pointer;
                        padding: 0;
                        width: 32px;
                        height: 32px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 6px;
                        transition: all 0.2s;
                        flex-shrink: 0;
                    }

                    .close-btn:hover {
                        background: rgba(248, 113, 113, 0.1);
                        color: var(--error);
                    }

                    .log-viewport {
                        flex: 1;
                        padding: 20px;
                        font-family: 'Courier New', monospace;
                        font-size: 13px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                        line-height: 1.8;
                        color: var(--accent-tertiary);
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
                        padding: 40px;
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

                    .modal-footer {
                        padding: 16px 24px;
                        border-top: 1px solid var(--border-subtle);
                        display: flex;
                        gap: 12px;
                        justify-content: flex-end;
                        flex-shrink: 0;
                        background: rgba(15, 23, 42, 0.5);
                    }

                    .btn-primary,
                    .btn-danger,
                    .btn-secondary {
                        padding: 10px 20px;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 600;
                        border: none;
                        cursor: pointer;
                        transition: all 0.2s;
                        position: relative;
                        overflow: hidden;
                    }

                    .btn-primary {
                        background: linear-gradient(135deg, var(--accent-tertiary), #06b6d4);
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
                        background: rgba(51, 65, 85, 0.8);
                        border-color: var(--accent-primary);
                        color: var(--text-primary);
                    }
                    
                    .log-selector {
                        background: var(--bg-input);
                        color: var(--text-primary);
                        border: 1px solid var(--border-subtle);
                        padding: 4px 10px;
                        border-radius: 6px;
                        font-size: 13px;
                        max-width: 300px;
                        transition: all 0.2s;
                    }

                    .log-selector:hover {
                        border-color: var(--accent-primary);
                    }

                    .log-selector:focus {
                        border-color: var(--accent-primary);
                        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
                        outline: none;
                    }
                `}</style>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
