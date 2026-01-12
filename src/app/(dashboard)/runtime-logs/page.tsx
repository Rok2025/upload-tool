'use client';

import { useState, useEffect, useRef } from 'react';

export default function LogPage() {
    const [logs, setLogs] = useState<string[]>([]);
    const [moduleId, setModuleId] = useState('1'); // Demo ID
    const [envId, setEnvId] = useState('1');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const startStreaming = () => {
        setLogs(['[SYSTEM] 正在连接日志流...']);
        const eventSource = new EventSource(`/api/logs?moduleId=${moduleId}&environmentId=${envId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.content) {
                setLogs(prev => [...prev.slice(-1000), data.content]);
            } else if (data.error) {
                setLogs(prev => [...prev, `[ERROR] ${data.error}`]);
                eventSource.close();
            }
        };

        eventSource.onerror = () => {
            setLogs(prev => [...prev, '[SYSTEM] 连接已断开。']);
            eventSource.close();
        };

        return () => eventSource.close();
    };

    return (
        <div className="log-container">
            <div className="log-header">
                <h2>实时运行日志</h2>
                <button className="btn-small" onClick={startStreaming}>开始监控</button>
            </div>
            <div className="log-viewport" ref={scrollRef}>
                {logs.map((log, i) => (
                    <div key={i} className="log-line">{log}</div>
                ))}
            </div>

            <style jsx>{`
        .log-container { background: #0f172a; color: #38bdf8; border-radius: 12px; height: 80vh; display: flex; flex-direction: column; overflow: hidden; }
        .log-header { padding: 16px 24px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
        .log-header h2 { font-size: 16px; color: #f8fafc; }
        .log-viewport { flex: 1; padding: 20px; font-family: 'Courier New', monospace; font-size: 13px; overflow-y: auto; white-space: pre-wrap; }
        .log-line { margin-bottom: 4px; }
        .btn-small { background: #38bdf8; color: #0f172a; padding: 6px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; }
      `}</style>
        </div>
    );
}
