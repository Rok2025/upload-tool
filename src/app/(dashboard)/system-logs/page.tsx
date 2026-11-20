'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SystemLog {
    id: number;
    level: 'info' | 'warn' | 'error';
    category: string;
    action: string;
    message: string;
    detail: string | null;
    target_host: string | null;
    user_id: number | null;
    username: string | null;
    created_at: string;
}

const LEVEL_OPTIONS = [
    { value: '', label: '全部级别' },
    { value: 'info', label: 'Info' },
    { value: 'warn', label: 'Warn' },
    { value: 'error', label: 'Error' },
];

const CATEGORY_OPTIONS = [
    { value: '', label: '全部分类' },
    { value: 'ssh', label: 'SSH连接' },
    { value: 'auth', label: '认证登录' },
    { value: 'deploy', label: '部署操作' },
    { value: 'config', label: '配置变更' },
    { value: 'system', label: '系统' },
];

export default function SystemLogsPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ level: '', category: '', keyword: '' });
    const [pagination, setPagination] = useState({ total: 0, limit: 30, offset: 0, hasMore: false });
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState<SystemLog | null>(null);
    const [keywordInput, setKeywordInput] = useState('');

    const fetchLogs = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const limit = 30;
            const offset = (page - 1) * limit;
            const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
            if (filters.level) params.append('level', filters.level);
            if (filters.category) params.append('category', filters.category);
            if (filters.keyword) params.append('keyword', filters.keyword);

            const res = await fetch(`/api/system-logs?${params}`);
            if (!res.ok) {
                if (res.status === 401) { router.push('/login'); return; }
                throw new Error('Failed to fetch system logs');
            }

            const data = await res.json();
            setLogs(data.logs);
            setPagination(data.pagination);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error fetching system logs:', error);
        } finally {
            setLoading(false);
        }
    }, [filters, router]);

    useEffect(() => { fetchLogs(1); }, [fetchLogs]);

    const totalPages = Math.ceil(pagination.total / pagination.limit);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages && !loading) fetchLogs(page);
    };

    const handleKeywordSearch = () => {
        setFilters(prev => ({ ...prev, keyword: keywordInput }));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleKeywordSearch();
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    };

    const getLevelTag = (level: string) => {
        switch (level) {
            case 'info': return { text: 'INFO', cls: 'level-info' };
            case 'warn': return { text: 'WARN', cls: 'level-warn' };
            case 'error': return { text: 'ERROR', cls: 'level-error' };
            default: return { text: level.toUpperCase(), cls: '' };
        }
    };

    const getCategoryLabel = (cat: string) => {
        const m: Record<string, string> = { ssh: 'SSH连接', auth: '认证登录', deploy: '部署操作', config: '配置变更', system: '系统' };
        return m[cat] || cat;
    };

    return (
        <div className="p-8 syslog-container">
            <header className="mb-8">
                <h1 className="text-3xl font-extrabold text-slate-900 mb-1">系统日志</h1>
                <p className="text-slate-500 text-sm">查看系统级操作记录，包括SSH连接、认证、部署等关键事件</p>
            </header>

            <div className="bg-transparent rounded-2xl border border-[rgba(99,102,241,0.2)] overflow-hidden" style={{ background: 'var(--bg-card)', backdropFilter: 'var(--backdrop-blur)' }}>
                {/* Filter Bar */}
                <div className="filter-bar no-scrollbar">
                    <div className="filter-item">
                        <label className="filter-label">日志级别</label>
                        <select
                            value={filters.level}
                            onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                            className="compact-select"
                        >
                            {LEVEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="filter-item">
                        <label className="filter-label">日志分类</label>
                        <select
                            value={filters.category}
                            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                            className="compact-select"
                        >
                            {CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div className="filter-item keyword-filter">
                        <label className="filter-label">关键词搜索</label>
                        <div className="keyword-input-group">
                            <input
                                type="text"
                                value={keywordInput}
                                onChange={(e) => setKeywordInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="搜索消息、主机、操作..."
                                className="compact-input"
                            />
                            <button onClick={handleKeywordSearch} className="search-btn">搜索</button>
                        </div>
                    </div>
                    <div className="filter-item" style={{ marginLeft: 'auto' }}>
                        <label className="filter-label">&nbsp;</label>
                        <button
                            onClick={() => { setFilters({ level: '', category: '', keyword: '' }); setKeywordInput(''); }}
                            className="reset-btn"
                        >
                            重置
                        </button>
                    </div>
                </div>

                {/* Table */}
                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                        </div>
                    )}

                    <table className="syslog-table">
                        <thead>
                            <tr>
                                <th style={{ width: '160px' }}>时间</th>
                                <th style={{ width: '60px' }}>级别</th>
                                <th style={{ width: '120px' }}>分类</th>
                                <th style={{ width: '130px' }}>操作</th>
                                <th>消息</th>
                                <th style={{ width: '130px' }}>目标主机</th>
                                <th style={{ width: '80px' }}>操作人</th>
                                <th style={{ width: '70px' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 && !loading ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-12 text-slate-400">
                                        暂无系统日志
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => {
                                    const levelTag = getLevelTag(log.level);
                                    return (
                                        <tr key={log.id}>
                                            <td className="font-mono text-xs">{formatDate(log.created_at)}</td>
                                            <td><span className={`level-tag ${levelTag.cls}`}>{levelTag.text}</span></td>
                                            <td><span className="category-tag">{getCategoryLabel(log.category)}</span></td>
                                            <td className="font-mono text-xs">{log.action}</td>
                                            <td className="msg-cell">{log.message}</td>
                                            <td className="font-mono text-xs">{log.target_host || '--'}</td>
                                            <td>{log.username || '--'}</td>
                                            <td>
                                                {log.detail && (
                                                    <button className="detail-btn" onClick={() => setSelectedLog(log)}>详情</button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination-bar">
                        <span className="page-info">共 {pagination.total} 条，第 {currentPage}/{totalPages} 页</span>
                        <div className="page-btns">
                            <button disabled={currentPage === 1} onClick={() => handlePageChange(1)} className="page-btn">首页</button>
                            <button disabled={currentPage === 1} onClick={() => handlePageChange(currentPage - 1)} className="page-btn">上一页</button>
                            <button disabled={currentPage === totalPages} onClick={() => handlePageChange(currentPage + 1)} className="page-btn">下一页</button>
                            <button disabled={currentPage === totalPages} onClick={() => handlePageChange(totalPages)} className="page-btn">末页</button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedLog && (
                <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
                    <div className="report-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="text-lg font-bold">日志详情</h3>
                                <p className="text-xs text-slate-400 mt-1">ID: {selectedLog.id}</p>
                            </div>
                            <button className="close-x-btn" onClick={() => setSelectedLog(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="detail-item">
                                    <label className="detail-label">时间</label>
                                    <div className="mt-1 font-mono text-sm">{formatDate(selectedLog.created_at)}</div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">级别</label>
                                    <div className="mt-1">
                                        <span className={`level-tag ${getLevelTag(selectedLog.level).cls}`}>{getLevelTag(selectedLog.level).text}</span>
                                    </div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">分类</label>
                                    <div className="mt-1 font-bold">{getCategoryLabel(selectedLog.category)}</div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">操作</label>
                                    <div className="mt-1 font-mono text-sm">{selectedLog.action}</div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">目标主机</label>
                                    <div className="mt-1 font-mono">{selectedLog.target_host || '--'}</div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">操作人</label>
                                    <div className="mt-1 font-bold">{selectedLog.username || '--'}</div>
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="detail-label">消息</label>
                                <div className="log-box" style={{ maxHeight: '80px' }}>{selectedLog.message}</div>
                            </div>

                            {selectedLog.detail && (
                                <div className="log-section">
                                    <label className="detail-label">详细信息</label>
                                    <div className="log-box">{selectedLog.detail}</div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-close" onClick={() => setSelectedLog(null)}>确认关闭</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .syslog-container {
                    background: transparent;
                    min-height: 100vh;
                    padding: 0;
                }
                .syslog-container header h1 {
                    font-size: 28px;
                    font-weight: 800;
                    color: var(--text-primary);
                    margin-bottom: 4px;
                }
                [data-theme="dark"] .syslog-container header h1 {
                    background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .syslog-container header p {
                    color: var(--text-muted);
                }
                .filter-bar {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px 24px;
                    background: var(--bg-card);
                    border-bottom: 1px solid var(--border-subtle);
                    overflow-x: auto;
                    flex-wrap: nowrap;
                }
                .filter-item {
                    flex-shrink: 0;
                }
                .filter-label {
                    display: block;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--text-muted);
                    margin-bottom: 8px;
                }
                .compact-select {
                    width: 140px;
                    height: 32px;
                    padding: 0 12px;
                    background: var(--bg-input);
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    font-size: 13px;
                    color: var(--text-primary);
                    outline: none;
                    transition: all 0.2s;
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236366f1'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    background-size: 12px;
                }
                .compact-select:focus {
                    border-color: var(--accent-primary);
                    box-shadow: var(--shadow-glow);
                }
                .compact-select:hover {
                    border-color: rgba(99, 102, 241, 0.4);
                }
                .keyword-filter {
                    min-width: 260px;
                }
                .keyword-input-group {
                    display: flex;
                    gap: 6px;
                }
                .compact-input {
                    flex: 1;
                    height: 32px;
                    padding: 0 12px;
                    background: var(--bg-input);
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    font-size: 13px;
                    color: var(--text-primary);
                    outline: none;
                    transition: all 0.2s;
                }
                .compact-input:focus {
                    border-color: var(--accent-primary);
                    box-shadow: var(--shadow-glow);
                }
                .compact-input::placeholder {
                    color: var(--text-muted);
                }
                .search-btn {
                    height: 32px;
                    padding: 0 14px;
                    background: var(--accent-gradient);
                    color: #fff;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    white-space: nowrap;
                }
                .search-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px -2px rgba(99, 102, 241, 0.4);
                }
                .reset-btn {
                    height: 32px;
                    padding: 0 14px;
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--accent-primary);
                    border: 1px solid var(--border-subtle);
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .reset-btn:hover {
                    background: rgba(99, 102, 241, 0.2);
                    border-color: var(--accent-primary);
                }

                .syslog-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .syslog-table th {
                    padding: 12px 16px;
                    background: rgba(99, 102, 241, 0.05);
                    border-bottom: 1px solid var(--border-subtle);
                    text-align: left;
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .syslog-table td {
                    padding: 10px 16px;
                    border-bottom: 1px solid var(--border-light);
                    font-size: 13px;
                    color: var(--text-secondary);
                }
                .syslog-table tbody tr:hover {
                    background: rgba(99, 102, 241, 0.05);
                }
                .msg-cell {
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .level-tag {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 700;
                    display: inline-flex;
                    border: 1px solid;
                    letter-spacing: 0.03em;
                }
                .level-info {
                    background: rgba(96, 165, 250, 0.15);
                    color: #60a5fa;
                    border-color: rgba(96, 165, 250, 0.3);
                }
                .level-warn {
                    background: rgba(250, 204, 21, 0.15);
                    color: #eab308;
                    border-color: rgba(250, 204, 21, 0.3);
                }
                .level-error {
                    background: rgba(248, 113, 113, 0.15);
                    color: #f87171;
                    border-color: rgba(248, 113, 113, 0.3);
                }
                .category-tag {
                    padding: 2px 8px;
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--accent-primary);
                    font-size: 11px;
                    font-weight: 600;
                    border-radius: 4px;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                }

                .detail-btn {
                    padding: 4px 12px;
                    background: rgba(99, 102, 241, 0.1);
                    color: var(--accent-primary);
                    font-size: 12px;
                    font-weight: 600;
                    border-radius: 6px;
                    border: 1px solid var(--border-subtle);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .detail-btn:hover {
                    background: rgba(99, 102, 241, 0.2);
                    border-color: var(--accent-primary);
                    box-shadow: var(--shadow-glow);
                }

                .pagination-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 24px;
                    border-top: 1px solid var(--border-subtle);
                }
                .page-info {
                    font-size: 13px;
                    color: var(--text-muted);
                }
                .page-btns {
                    display: flex;
                    gap: 6px;
                }
                .page-btn {
                    padding: 6px 14px;
                    background: rgba(99, 102, 241, 0.08);
                    color: var(--accent-primary);
                    font-size: 12px;
                    font-weight: 600;
                    border-radius: 6px;
                    border: 1px solid var(--border-subtle);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .page-btn:hover:not(:disabled) {
                    background: rgba(99, 102, 241, 0.2);
                    border-color: var(--accent-primary);
                }
                .page-btn:disabled {
                    opacity: 0.4;
                    cursor: not-allowed;
                }

                .modal-backdrop {
                    position: fixed;
                    top: 0;
                    left: 260px;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(8px);
                }
                .report-modal {
                    background: var(--bg-card-solid);
                    border: 1px solid var(--border-subtle);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 750px;
                    max-height: 85vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), var(--shadow-glow);
                    overflow: hidden;
                    animation: modalIn 0.3s ease-out;
                    position: relative;
                }
                .report-modal::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 20%;
                    right: 20%;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, var(--accent-primary), var(--accent-tertiary), var(--accent-primary), transparent);
                }
                @keyframes modalIn {
                    from { transform: translateY(-20px) scale(0.98); opacity: 0; }
                    to { transform: translateY(0) scale(1); opacity: 1; }
                }
                .modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid var(--border-subtle);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .modal-header h3 { color: var(--text-primary); }
                .modal-header p { color: var(--text-muted); }
                .close-x-btn {
                    background: rgba(99, 102, 241, 0.1);
                    border: 1px solid var(--border-subtle);
                    font-size: 14px;
                    color: var(--text-muted);
                    cursor: pointer;
                    padding: 8px 12px;
                    border-radius: 8px;
                    transition: all 0.2s;
                }
                .close-x-btn:hover {
                    color: var(--accent-primary);
                    border-color: var(--accent-primary);
                }
                .modal-body {
                    padding: 24px;
                    overflow-y: auto;
                    flex: 1;
                }
                .detail-label {
                    font-size: 12px;
                    font-weight: 700;
                    color: var(--text-muted);
                    margin-bottom: 8px;
                    display: block;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .detail-item div { color: var(--text-primary); }
                .log-box {
                    background: var(--bg-primary);
                    color: var(--accent-tertiary);
                    padding: 16px;
                    border-radius: 8px;
                    font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
                    font-size: 12px;
                    line-height: 1.6;
                    white-space: pre-wrap;
                    margin-top: 8px;
                    border: 1px solid var(--border-subtle);
                    max-height: 300px;
                    overflow-y: auto;
                }
                .modal-footer {
                    padding: 16px 24px;
                    border-top: 1px solid var(--border-subtle);
                    display: flex;
                    justify-content: flex-end;
                }
                .btn-close {
                    background: var(--accent-gradient);
                    color: #fff;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-close:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 5px 20px -5px rgba(99, 102, 241, 0.5);
                }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
