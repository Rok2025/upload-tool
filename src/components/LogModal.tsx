'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface LogModalProps {
    moduleId: number;
    moduleName: string;
    environmentId: number | null;
    onClose: () => void;
}

export function LogModal({ moduleId, moduleName, environmentId, onClose }: LogModalProps) {
    const [logs, setLogs] = useState<string[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
    const [mounted, setMounted] = useState(false);

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

        setLogs([`[SYSTEM] 正在连接到 ${moduleName} 的日志流...`]);
        setConnectionStatus('connecting');
        setIsStreaming(true);

        const eventSource = new EventSource(`/api/logs?moduleId=${moduleId}&environmentId=${environmentId}`);
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

    if (!mounted) return null;

    const modalContent = (
        <div className="modal-overlay" onClick={onClose}>
            <div className="log-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h3>实时运行日志 - {moduleName}</h3>
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
                        background: rgba(15, 23, 42, 0.75);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 100000;
                        backdrop-filter: blur(12px);
                        padding: 40px;
                        animation: fadeIn 0.3s ease;
                    }

                    .log-modal {
                        background: #0f172a;
                        border-radius: 16px;
                        width: 100%;
                        max-width: 1100px;
                        height: 85vh;
                        max-height: 850px;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.1), 0 25px 50px -12px rgba(0, 0, 0, 0.7);
                        overflow: hidden;
                        position: relative;
                        animation: modalShow 0.4s cubic-bezier(0, 0, 0.2, 1);
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
                        border-bottom: 1px solid #1e293b;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        flex-shrink: 0;
                    }

                    .modal-header h3 {
                        font-size: 18px;
                        color: #f8fafc;
                        margin: 0 0 8px 0;
                    }

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

                    .close-btn {
                        background: none;
                        border: none;
                        color: #94a3b8;
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
                        background: #1e293b;
                        color: #f8fafc;
                    }

                    .log-viewport {
                        flex: 1;
                        padding: 20px;
                        font-family: 'Courier New', monospace;
                        font-size: 13px;
                        overflow-y: auto;
                        white-space: pre-wrap;
                        line-height: 1.6;
                        color: #38bdf8;
                        background: #0f172a;
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

                    .modal-footer {
                        padding: 16px 24px;
                        border-top: 1px solid #1e293b;
                        display: flex;
                        gap: 12px;
                        justify-content: flex-end;
                        flex-shrink: 0;
                        background: #0f172a;
                    }

                    .btn-primary,
                    .btn-danger,
                    .btn-secondary {
                        padding: 10px 20px;
                        border-radius: 6px;
                        font-size: 14px;
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
                `}</style>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
