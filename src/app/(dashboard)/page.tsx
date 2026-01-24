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
    start_time: string;
    log_type: 'deploy' | 'restart' | 'stop' | null;
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
            <div className="label">服务器</div>
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
        <div className="section-header">
          <h2>最近发布记录</h2>
          <a href="/history" className="view-all">查看全部历史 →</a>
        </div>

        <div className="activity-container">
          {stats?.recentDeployments && stats.recentDeployments.length > 0 ? (
            <div className="activity-feed">
              <div className="timeline-line"></div>
              {stats.recentDeployments.map((deploy) => (
                <div key={deploy.id} className="activity-item">
                  <div className={`status-icon ${deploy.status === 'success' ? 'success' : 'error'}`}>
                    {deploy.status === 'success' ? '✓' : '✕'}
                  </div>
                  <div className="activity-content">
                    <div className="activity-main">
                      <div className="activity-title">
                        <span className="project-name">{deploy.project_name}</span>
                        <span className="separator">/</span>
                        <span className="module-name">{deploy.module_name}</span>
                      </div>
                      <div className="activity-meta">
                        <span className="type-badge" data-type={deploy.log_type || 'deploy'}>
                          {deploy.log_type === 'restart' ? '重启' : deploy.log_type === 'stop' ? '停止' : '发包'}
                        </span>
                        <span className="version-tag">{deploy.version || 'v1.0.0'}</span>
                        <span className="server-name">
                          <span className="icon">🖥️</span>
                          {(deploy as any).environment_name || '未知服务器'}
                        </span>
                      </div>
                    </div>
                    <div className="activity-time">
                      {formatRelativeTime(deploy.start_time)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">📂</div>
              <p>暂无发布记录</p>
              <span>开始部署您的第一个项目吧！</span>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .dashboard {
          max-width: 1200px;
          margin: 0 auto;
        }
        .dashboard h1 { 
          font-size: 28px; 
          font-weight: 800; 
          color: var(--text-primary);
          margin-bottom: 8px; 
        }
        [data-theme="dark"] .dashboard h1 {
          background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .subtitle { color: var(--text-muted); margin-bottom: 40px; font-size: 15px; }
        .loading { text-align: center; padding: 100px; color: var(--text-muted); font-size: 18px; }
        
        .stats-grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); 
          gap: 20px; 
          margin-bottom: 48px;
        }
        .stat-card {
          background: var(--bg-card);
          backdrop-filter: var(--backdrop-blur);
          padding: 24px;
          border-radius: 16px;
          border: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        [data-theme="dark"] .stat-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.3), transparent);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-glow);
        }
        [data-theme="dark"] .stat-card:hover {
          border-color: rgba(99, 102, 241, 0.4);
        }
        [data-theme="dark"] .stat-card:hover::before {
          opacity: 1;
        }
        .stat-icon {
          font-size: 28px;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
        }
        .stat-info { flex: 1; }
        .stat-card .label { 
          color: var(--text-muted); 
          font-size: 13px; 
          font-weight: 600; 
          text-transform: uppercase; 
          letter-spacing: 0.05em; 
          margin-bottom: 4px; 
        }
        .stat-card .value { 
          font-size: 32px; 
          font-weight: 800; 
          color: var(--text-primary);
          line-height: 1; 
        }
        [data-theme="dark"] .stat-card .value {
          background: linear-gradient(135deg, #f1f5f9 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .stat-card .value.success { 
          color: var(--success);
        }
        [data-theme="dark"] .stat-card .value.success {
          background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .recent-activity { margin-top: 16px; }
        .section-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 24px; 
        }
        .section-header h2 { 
          font-size: 20px; 
          font-weight: 700; 
          color: var(--text-primary); 
          margin: 0; 
        }
        .view-all { 
          font-size: 14px; 
          font-weight: 600; 
          color: var(--accent-primary); 
          text-decoration: none;
          transition: all 0.2s;
          padding: 6px 12px;
          border-radius: 6px;
        }
        .view-all:hover { 
          background: rgba(99, 102, 241, 0.1);
        }

        .activity-container {
          background: var(--bg-card);
          backdrop-filter: var(--backdrop-blur);
          border-radius: 20px;
          padding: 24px;
          border: 1px solid var(--border-subtle);
          position: relative;
        }

        .activity-feed {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .timeline-line {
          position: absolute;
          left: 20px;
          top: 8px;
          bottom: 8px;
          width: 2px;
          background: linear-gradient(180deg, var(--border-subtle), rgba(99, 102, 241, 0.3), var(--border-subtle));
        }

        .activity-item {
          display: flex;
          gap: 20px;
          position: relative;
          z-index: 1;
          padding: 12px 16px;
          border-radius: 12px;
          transition: all 0.2s;
          border: 1px solid transparent;
        }
        .activity-item:hover {
          background: rgba(99, 102, 241, 0.05);
          border-color: var(--border-subtle);
        }

        .status-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: bold;
          flex-shrink: 0;
          box-shadow: 0 0 0 4px var(--bg-primary);
        }
        .status-icon.success {
          background: rgba(74, 222, 128, 0.2);
          color: #4ade80;
          border: 1px solid rgba(74, 222, 128, 0.3);
        }
        .status-icon.error {
          background: rgba(248, 113, 113, 0.2);
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.3);
        }

        .activity-content {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .activity-main {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .activity-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .activity-title .project-name { color: var(--text-primary); }
        .activity-title .module-name { color: var(--accent-primary); }
        .activity-title .separator { color: var(--text-muted); font-weight: normal; }

        .activity-meta {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .type-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .type-badge[data-type="deploy"] { 
          background: rgba(99, 102, 241, 0.2); 
          color: #818cf8;
          border: 1px solid rgba(99, 102, 241, 0.3);
        }
        .type-badge[data-type="restart"] { 
          background: rgba(251, 146, 60, 0.2); 
          color: #fb923c;
          border: 1px solid rgba(251, 146, 60, 0.3);
        }
        .type-badge[data-type="stop"] { 
          background: rgba(248, 113, 113, 0.2); 
          color: #f87171;
          border: 1px solid rgba(248, 113, 113, 0.3);
        }

        .version-tag {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.05);
          padding: 3px 8px;
          border-radius: 4px;
          font-family: monospace;
          border: 1px solid var(--border-light);
        }
        .server-name {
          font-size: 12px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .server-name .icon { font-size: 11px; }

        .activity-time {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 500;
          white-space: nowrap;
        }
        
        .empty-state {
          text-align: center;
          padding: 64px 32px;
          color: var(--text-muted);
        }
        .empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
        .empty-state p {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .empty-state span {
          font-size: 15px;
        }
      `}</style>
    </div>
  );
}

// Simple relative time formatter
function formatRelativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return '刚刚';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分钟前`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小时前`;
  if (diffInSeconds < 172800) return '昨天';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

