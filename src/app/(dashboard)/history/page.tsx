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
}

export default function HistoryPage() {
    const router = useRouter();
    const [logs, setLogs] = useState<DeployLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [selectedLog, setSelectedLog] = useState<DeployLog | null>(null);
    const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0, hasMore: false });

    const fetchLogs = async (offset = 0) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                limit: '50',
                offset: offset.toString(),
            });
            if (statusFilter) params.append('status', statusFilter);

            const res = await fetch(`/api/deploy-logs?${params}`);
            if (!res.ok) {
                if (res.status === 401) {
                    router.push('/login');
                    return;
                }
                throw new Error('Failed to fetch logs');
            }

            const data = await res.json();
            if (offset === 0) {
                setLogs(data.logs);
            } else {
                setLogs(prev => [...prev, ...data.logs]);
            }
            setPagination(data.pagination);
        } catch (error) {
            console.error('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs(0);
    }, [statusFilter]);

    const loadMore = () => {
        if (pagination.hasMore && !loading) {
            fetchLogs(pagination.offset + pagination.limit);
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

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">部署历史</h1>
                <div className="flex gap-4 items-center">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                    >
                        <option value="">全部状态</option>
                        <option value="success">成功</option>
                        <option value="failed">失败</option>
                    </select>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                        共 {pagination.total} 条记录
                    </span>
                </div>
            </div>

            {loading && logs.length === 0 ? (
                <div className="text-center py-12">
                    <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-600 rounded-full" role="status">
                        <span className="sr-only">加载中...</span>
                    </div>
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">暂无部署记录</div>
            ) : (
                <>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-900">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">时间</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">用户</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">项目 → 模块</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">环境</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">状态</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">版本</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {formatDate(log.start_time)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {log.username}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <div className="text-gray-900 dark:text-gray-100">{log.project_name}</div>
                                            <div className="text-gray-500 dark:text-gray-400 text-xs">→ {log.module_name}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                                            {log.environment_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(log.status)}`}>
                                                {getStatusText(log.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 font-mono">
                                            {log.version || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                            >
                                                查看详情
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {pagination.hasMore && (
                        <div className="mt-6 text-center">
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? '加载中...' : '加载更多'}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Details Modal */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-6 border-b dark:border-gray-700">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-xl font-bold mb-2">部署详情</h2>
                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                        <p>项目: {selectedLog.project_name} → {selectedLog.module_name}</p>
                                        <p>环境: {selectedLog.environment_name}</p>
                                        <p>用户: {selectedLog.username}</p>
                                        <p>时间: {formatDate(selectedLog.start_time)}</p>
                                        {selectedLog.version && <p>版本: {selectedLog.version}</p>}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedLog(null)}
                                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-96">
                            <h3 className="font-semibold mb-2">日志输出:</h3>
                            {selectedLog.log_output ? (
                                <pre className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                                    {selectedLog.log_output}
                                </pre>
                            ) : (
                                <p className="text-gray-500 dark:text-gray-400">无日志输出</p>
                            )}
                        </div>
                        <div className="p-6 border-t dark:border-gray-700 flex justify-end">
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
