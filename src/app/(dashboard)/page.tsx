'use client';

import { useState, useEffect } from 'react';

interface Stats {
  projectCount: number;
  moduleCount: number;
  envCount: number;
  todayDeployCount: number;
  recentDeployments: {
    id: number;
    project_name: string;
    module_name: string;
    version: string;
    status: string;
    created_at: string;
  }[];
  systemStatus: string;
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats');
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="dashboard">
      <h1>部署控制台</h1>
      <p className="subtitle">欢迎回来，您可以开始发布或查看历史记录。</p>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📁</div>
          <div className="stat-info">
            <div className="label">项目数量</div>
            <div className="value">{stats?.projectCount ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📦</div>
          <div className="stat-info">
            <div className="label">模块总数</div>
            <div className="value">{stats?.moduleCount ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🖥️</div>
          <div className="stat-info">
            <div className="label">部署环境</div>
            <div className="value">{stats?.envCount ?? 0}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🚀</div>
          <div className="stat-info">
            <div className="label">今日发布</div>
            <div className="value">{stats?.todayDeployCount ?? 0}</div>
          </div>
        </div>
        <div className="stat-card status-card">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="label">系统状态</div>
            <div className="value success">{stats?.systemStatus === 'online' ? '正常' : '异常'}</div>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h2>最近发布记录</h2>
        <div className="card">
          {stats?.recentDeployments && stats.recentDeployments.length > 0 ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>模块</th>
                  <th>版本</th>
                  <th>状态</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentDeployments.map((deploy) => (
                  <tr key={deploy.id}>
                    <td>{deploy.project_name}</td>
                    <td>{deploy.module_name}</td>
                    <td>{deploy.version}</td>
                    <td>
                      <span className={`badge ${deploy.status === 'success' ? 'success' : 'error'}`}>
                        {deploy.status === 'success' ? '成功' : '失败'}
                      </span>
                    </td>
                    <td>{new Date(deploy.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <p>暂无发布记录</p>
              <span>开始部署您的第一个项目吧！</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .dashboard h1 { font-size: 24px; margin-bottom: 8px; }
        .subtitle { color: #64748b; margin-bottom: 32px; }
        .loading { text-align: center; padding: 48px; color: #64748b; }
        
        .stats-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
          gap: 20px; 
          margin-bottom: 40px;
        }
        .stat-card {
          background: #fff;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .stat-icon {
          font-size: 32px;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          border-radius: 12px;
        }
        .stat-info { flex: 1; }
        .stat-card .label { color: #64748b; font-size: 14px; margin-bottom: 4px; }
        .stat-card .value { font-size: 28px; font-weight: bold; color: #1e293b; }
        .stat-card .value.success { color: #10b981; }
        
        .recent-activity h2 { font-size: 18px; margin-bottom: 16px; }
        .card { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th, .data-table td { padding: 16px; text-align: left; border-bottom: 1px solid #f1f5f9; }
        .data-table th { background: #f8fafc; font-weight: 600; color: #475569; font-size: 13px; }
        .data-table td { font-size: 14px; }
        .badge { padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 500; }
        .badge.success { background: #d1fae5; color: #065f46; }
        .badge.error { background: #fee2e2; color: #991b1b; }
        
        .empty-state {
          text-align: center;
          padding: 48px;
          color: #94a3b8;
        }
        .empty-state p {
          font-size: 16px;
          margin-bottom: 8px;
        }
        .empty-state span {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
