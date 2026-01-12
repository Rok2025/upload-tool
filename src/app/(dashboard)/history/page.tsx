'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface DeployLog {
    id: number;
    user_id: number;
    module_id: number;
    environment_id: number;
    status: 'pending' | 'deploying' | 'success' | 'failed' | 'rollback';
    version: string | null;
    log_output: string | null;
    start_time: string;
    end_time: string | null;
    username: string;
    module_name: string;
    module_type: string;
    project_name: string;
    project_id: number;
    environment_name: string;
    log_type: 'deploy' | 'restart' | 'stop' | null;
}

export default function HistoryPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<DeployLog[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [environments, setEnvironments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: '',
        projectId: '',
        moduleId: '',
        environmentId: '',
        moduleType: '',
        logType: ''
    });
    const [selectedLog, setSelectedLog] = useState<DeployLog | null>(null);
    const [pagination, setPagination] = useState({ total: 0, limit: 15, offset: 0, hasMore: false });
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const loadInitialData = async () => {
            const [projRes, envRes] = await Promise.all([
                fetch('/api/projects'),
                fetch('/api/environments')
            ]);
            if (projRes.ok) setProjects(await projRes.json());
            if (envRes.ok) setEnvironments(await envRes.json());
        };
        loadInitialData();
    }, []);

    const fetchLogs = async (page = 1) => {
        try {
            setLoading(true);
            const limit = 15;
            const offset = (page - 1) * limit;
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            if (filters.status) params.append('status', filters.status);
            if (filters.projectId) params.append('projectId', filters.projectId);
            if (filters.moduleId) params.append('moduleId', filters.moduleId);
            if (filters.environmentId) params.append('environmentId', filters.environmentId);
            if (filters.logType) params.append('logType', filters.logType);

            const res = await fetch(`/api/deploy-logs?${params}`);
            if (!res.ok) {
                if (res.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error('Failed to fetch logs');
            }

            const data = await res.json();
            let fetchedLogs = data.logs;

            // Client-side filtering for moduleType if API doesn't support it yet
            if (filters.moduleType) {
                fetchedLogs = fetchedLogs.filter((l: any) => l.module_type === filters.moduleType);
            }

            setLogs(fetchedLogs);
            setPagination(data.pagination);
            setCurrentPage(page);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(1);
    }, [filters]);

    const totalPages = Math.ceil(pagination.total / pagination.limit);

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages && !loading) {
            fetchLogs(page);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'success': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
            case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
            case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
            case 'deploying': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'success': return '成功';
            case 'failed': return '失败';
            case 'pending': return '待处理';
            case 'deploying': return '部署中';
            case 'rollback': return '回滚';
            default: return status;
        }
    };

    const getLogTypeInfo = (type: string | null) => {
        switch (type) {
            case 'restart': return { text: '重启服务', color: 'bg-orange-100 text-orange-800 border-orange-200' };
            case 'stop': return { text: '停止服务', color: 'bg-rose-100 text-rose-800 border-rose-200' };
            case 'deploy':
            default: return { text: '发包部署', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
        }
    };

    return (
        <div className="p-8 history-container">
            <header className="mb-8">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-1">部署历史</h1>
                        <p className="text-slate-500 text-sm">查看项目发布记录与详细执行日志</p>
                    </div>
                </div>
            </header>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Integrated Filter Bar - Single Line Layout */}
                <div className="filter-bar no-scrollbar">
                    <div className="filter-item">
                        <label className="filter-label">所属项目</label>
                        <select
                            value={filters.projectId}
                            onChange={(e) => setFilters(prev => ({ ...prev, projectId: e.target.value, moduleId: '' }))}
                            className="compact-select"
                        >
                            <option value="">全部项目</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-item">
                        <label className="filter-label">具体模块</label>
                        <select
                            value={filters.moduleId}
                            onChange={(e) => setFilters(prev => ({ ...prev, moduleId: e.target.value }))}
                            className="compact-select"
                            disabled={!filters.projectId}
                        >
                            <option value="">全部模块</option>
                            {projects.find(p => p.id === parseInt(filters.projectId))?.modules?.map((m: any) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-item">
                        <label className="filter-label">服务器</label>
                        <select
                            value={filters.environmentId}
                            onChange={(e) => setFilters(prev => ({ ...prev, environmentId: e.target.value }))}
                            className="compact-select"
                        >
                            <option value="">全部环境</option>
                            {environments.map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-item">
                        <label className="filter-label">任务状态</label>
                        <select
                            value={filters.status}
                            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                            className="compact-select"
                        >
                            <option value="">全部状态</option>
                            <option value="success">成功</option>
                            <option value="failed">失败</option>
                            <option value="deploying">进行中</option>
                        </select>
                    </div>

                    <div className="filter-item">
                        <label className="filter-label">操作类型</label>
                        <select
                            value={filters.logType}
                            onChange={(e) => setFilters(prev => ({ ...prev, logType: e.target.value }))}
                            className="compact-select"
                        >
                            <option value="">全部类型</option>
                            <option value="deploy">发包部署</option>
                            <option value="restart">重启服务</option>
                            <option value="stop">停止服务</option>
                        </select>
                    </div>
                </div>

                <div className="relative">
                    {loading && (
                        <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                        </div>
                    )}

                    <table className="history-table">
                        <thead>
                            <tr>
                                <th>时间</th>
                                <th>操作人</th>
                                <th>项目 → 模块</th>
                                <th>服务器</th>
                                <th>操作类型</th>
                                <th className="text-center">状态</th>
                                <th>版本标识</th>
                                <th className="text-right">管理</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-20 text-slate-400 font-medium">暂无部署记录</td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatDate(log.start_time).split(' ')[1]}</div>
                                            <div className="text-xs text-slate-400">{formatDate(log.start_time).split(' ')[0]}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-[10px] font-bold text-blue-600">
                                                    {log.username[0].toUpperCase()}
                                                </div>
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{log.username}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{log.project_name}</span>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    <span className="text-slate-300 dark:text-slate-600 text-xs text-bold">→</span>
                                                    <span className="text-xs font-medium text-slate-500 hover:text-blue-500 cursor-pointer">{log.module_name}</span>
                                                    <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded text-[9px] font-black uppercase">{log.module_type}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{log.environment_name}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 border rounded text-[10px] font-bold ${getLogTypeInfo(log.log_type).color}`}>
                                                {getLogTypeInfo(log.log_type).text}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-3 py-1 inline-flex text-[11px] font-black rounded-full uppercase tracking-tighter ${getStatusColor(log.status)}`}>
                                                {getStatusText(log.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-mono text-slate-600 dark:text-slate-400">
                                                {log.version || '--'}
                                            </span>
                                        </td>
                                        <td className="text-right">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="detail-btn"
                                            >
                                                详情报告
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="text-xs text-slate-400 font-bold">
                        第 {Math.min(pagination.offset + 1, pagination.total)} - {Math.min(pagination.offset + logs.length, pagination.total)} 条，共 {pagination.total} 条
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1 || loading}
                            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>

                        <div className="flex gap-1">
                            {[...Array(totalPages)].map((_, i) => {
                                const page = i + 1;
                                // Simplified pagination: show current, prev, next, first, last
                                if (
                                    page === 1 ||
                                    page === totalPages ||
                                    (page >= currentPage - 1 && page <= currentPage + 1)
                                ) {
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => handlePageChange(page)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === page
                                                ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                                : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    );
                                }
                                if (page === currentPage - 2 || page === currentPage + 2) {
                                    return <span key={page} className="w-4 text-center leading-8 text-slate-300">...</span>;
                                }
                                return null;
                            })}
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages || loading}
                            className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Details Modal */}
            {selectedLog && (
                <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
                    <div className="report-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">部署详情报告</h3>
                                <p className="text-sm text-slate-500 mt-1">{selectedLog.project_name} / {selectedLog.module_name}</p>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="close-x-btn"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="grid grid-cols-2 gap-8 mb-8">
                                <div className="detail-item">
                                    <label className="detail-label">执行状态</label>
                                    <div className="mt-1">
                                        <span className={`status-tag ${selectedLog.status === 'success' ? 'success' : selectedLog.status === 'failed' ? 'failed' : 'deploying'}`}>
                                            {getStatusText(selectedLog.status)}
                                        </span>
                                    </div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">开始时间</label>
                                    <div className="mt-1 text-slate-700 font-medium">{formatDate(selectedLog.start_time)}</div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">服务器</label>
                                    <div className="mt-1 font-bold text-slate-900">{selectedLog.environment_name}</div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">操作类型</label>
                                    <div className="mt-1">
                                        <span className={`px-2 py-0.5 border rounded text-xs font-bold ${getLogTypeInfo(selectedLog.log_type).color}`}>
                                            {getLogTypeInfo(selectedLog.log_type).text}
                                        </span>
                                    </div>
                                </div>
                                <div className="detail-item">
                                    <label className="detail-label">版本标识</label>
                                    <div className="mt-1 font-mono text-sm text-slate-600">{selectedLog.version || '--'}</div>
                                </div>
                            </div>

                            <div className="log-section">
                                <label className="detail-label">完整执行日志</label>
                                <div className="log-box">
                                    {selectedLog.log_output || '暂无日志输出'}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-close" onClick={() => setSelectedLog(null)}>确认关闭</button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .history-container {
                    background: #f4f7f9;
                    min-height: 100vh;
                    padding: 32px;
                }
                .filter-bar {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 16px 24px;
                    background: #f8fafc;
                    border-bottom: 1px solid #ebeef5;
                    overflow-x: auto;
                    flex-wrap: nowrap;
                }
                .filter-item {
                    flex-shrink: 0;
                }
                .filter-bar::-webkit-scrollbar {
                    height: 4px;
                }
                .filter-bar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 4px;
                }
                .filter-label {
                    display: block;
                    font-size: 12px;
                    font-weight: 600;
                    color: #606266;
                    margin-bottom: 8px;
                }
                .compact-select {
                    width: 160px;
                    height: 32px;
                    padding: 0 12px;
                    background: #fff;
                    border: 1px solid #dcdfe6;
                    border-radius: 4px;
                    font-size: 13px;
                    color: #606266;
                    outline: none;
                    transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
                    appearance: none;
                    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23c0c4cc'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
                    background-repeat: no-repeat;
                    background-position: right 8px center;
                    background-size: 12px;
                }
                .compact-select:focus {
                    border-color: #409eff;
                }
                .compact-select:hover {
                    border-color: #c0c4cc;
                }
                .compact-select:disabled {
                    background-color: #f5f7fa;
                    border-color: #e4e7ed;
                    color: #c0c4cc;
                    cursor: not-allowed;
                }
                .history-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .history-table th {
                    padding: 12px 16px;
                    background: #f5f7fa;
                    border-bottom: 1px solid #ebeef5;
                    text-align: left;
                    font-size: 13px;
                    font-weight: 700;
                    color: #909399;
                }
                .history-table td {
                    padding: 12px 16px;
                    border-bottom: 1px solid #ebeef5;
                    font-size: 14px;
                    color: #606266;
                }
                .detail-btn {
                    padding: 4px 12px;
                    background: transparent;
                    color: #409eff;
                    font-size: 13px;
                    font-weight: 500;
                    border-radius: 4px;
                    border: 1px solid transparent;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .detail-btn:hover {
                    color: #66b1ff;
                    background: #ecf5ff;
                    border-color: #d9ecff;
                }
                .status-tag {
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: 500;
                    display: inline-flex;
                    border-width: 1px;
                    border-style: solid;
                }
                .status-tag.success { background: #f0f9eb; color: #67c23a; border-color: #e1f3d8; }
                .status-tag.failed { background: #fef0f0; color: #f56c6c; border-color: #fde2e2; }
                .status-tag.deploying { background: #fdf6ec; color: #e6a23c; border-color: #faecd8; }

                .modal-backdrop {
                    position: fixed;
                    top: 0;
                    left: 240px; /* Sidebar offset */
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    backdrop-filter: blur(4px);
                }
                .report-modal {
                    background: #fff;
                    border-radius: 8px;
                    width: 100%;
                    max-width: 800px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
                    overflow: hidden;
                    animation: modalIn 0.3s ease-out;
                }
                @keyframes modalIn {
                    from { transform: translateY(-20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .modal-header {
                    padding: 20px 24px;
                    border-bottom: 1px solid #ebeef5;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .close-x-btn {
                    background: none; border: none; font-size: 16px; color: #909399;
                    cursor: pointer; padding: 4px; border-radius: 4px; transition: all 0.2s;
                }
                .close-x-btn:hover { color: #409eff; }

                .modal-body { padding: 24px; overflow-y: auto; flex: 1; }
                .detail-label { font-size: 13px; font-weight: 700; color: #606266; margin-bottom: 8px; display: block; }
                
                .log-box {
                    background: #f5f7fa;
                    color: #303133;
                    padding: 16px;
                    border-radius: 4px;
                    font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
                    font-size: 12px;
                    line-height: 1.5;
                    white-space: pre-wrap;
                    margin-top: 8px;
                    border: 1px solid #e4e7ed;
                }
                .modal-footer {
                    padding: 16px 24px;
                    border-top: 1px solid #ebeef5;
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }
                .btn-close {
                    background: #409eff; color: #fff; border: 1px solid #409eff; padding: 8px 16px;
                    border-radius: 4px; font-weight: 500; font-size: 14px; cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-close:hover { background: #66b1ff; border-color: #66b1ff; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>
        </div>
    );
}
