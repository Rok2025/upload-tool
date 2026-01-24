'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

import { DeploymentProvider } from '@/components/DeploymentProvider';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';
import { useTheme } from '@/components/ThemeProvider';

function SidebarLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="8" width="40" height="14" rx="3" fill="url(#g1)" />
      <rect x="12" y="26" width="40" height="14" rx="3" fill="url(#g2)" />
      <rect x="12" y="44" width="40" height="14" rx="3" fill="url(#g3)" />
      <circle cx="20" cy="15" r="2" fill="#4ade80" />
      <circle cx="20" cy="33" r="2" fill="#4ade80" />
      <circle cx="20" cy="51" r="2" fill="#facc15" />
      <rect x="26" y="14" width="20" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="26" y="32" width="20" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <rect x="26" y="50" width="20" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
      <defs>
        <linearGradient id="g1" x1="12" y1="8" x2="52" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b82f6" /><stop offset="1" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="g2" x1="12" y1="26" x2="52" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" /><stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
        <linearGradient id="g3" x1="12" y1="44" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" /><stop offset="1" stopColor="#a855f7" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
    >
      {theme === 'dark' ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ username: string; role: string } | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetch('/api/auth/me').then(res => {
      if (res.ok) {
        res.json().then(setCurrentUser);
      }
    }).catch(() => { });
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const menuItems = [
    { href: '/', label: '控制台首页', icon: '🏠' },
    { href: '/deploy', label: '部署发布', icon: '🚀' },
    { href: '/history', label: '部署历史', icon: '📜' },
    { href: '/runtime-logs', label: '运行日志', icon: '📋' },
    { href: '/config', label: '项目配置', icon: '⚙️' },
    { href: '/users', label: '用户管理', icon: '👥', adminOnly: true },
  ];

  const isActive = (href: string) => {
    if (!mounted) return href === '/';
    const normalizedPathname = pathname.replace(/\/$/, '') || '/';
    const normalizedHref = href.replace(/\/$/, '') || '/';

    if (normalizedHref === '/') {
      return normalizedPathname === '/';
    }
    return normalizedPathname === normalizedHref || normalizedPathname.startsWith(normalizedHref + '/');
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo">
          <SidebarLogo />
          <span>项目部署工具</span>
        </div>
        <nav>
          <ul>
            {menuItems
              .filter(item => !item.adminOnly || currentUser?.role === 'admin')
              .map((item) => (
                <li key={item.href} className={isActive(item.href) ? 'active' : ''}>
                  <Link href={item.href}>
                    <span className="menu-icon">{item.icon}</span>
                    {item.label}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          © 2026 中科金审科技
        </div>
      </aside>
      <main className="main-content">
        <header className="top-bar">
          <div className="top-bar-glow"></div>
          <div className="user-section">
            <ThemeToggle />
            <span className="user-info">
              <span className="user-avatar">{currentUser?.username?.charAt(0).toUpperCase() || '?'}</span>
              {currentUser?.username || '...'}
            </span>
            <button
              className="action-btn"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              修改密码
            </button>
            <button className="action-btn logout" onClick={handleLogout}>退出登录</button>
          </div>
        </header>
        <div className="content">
          <DeploymentProvider>
            {children}
          </DeploymentProvider>
        </div>
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      </main>
      <style jsx global>{`
        .app-container {
          display: flex;
          min-height: 100vh;
          position: relative;
          z-index: 1;
        }
        .sidebar {
          width: 260px;
          background: var(--sidebar-bg);
          backdrop-filter: var(--backdrop-blur);
          border-right: 1px solid var(--sidebar-border);
          padding: 24px 16px;
          display: flex;
          flex-direction: column;
          position: relative;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        [data-theme="dark"] .sidebar::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 1px;
          height: 100%;
          background: linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.3), transparent);
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          padding: 0 8px;
        }
        .logo span {
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary);
        }
        [data-theme="dark"] .logo span {
          background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .sidebar nav ul {
          list-style: none;
          flex: 1;
        }
        .sidebar nav li {
          margin-bottom: 4px;
        }
        .sidebar nav li a {
          color: var(--text-secondary);
          text-decoration: none;
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 10px;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .sidebar nav li a:hover {
          color: var(--text-primary);
          background: var(--bg-input);
        }
        [data-theme="dark"] .sidebar nav li a:hover {
          background: rgba(99, 102, 241, 0.1);
        }
        
        [data-theme="light"] .sidebar nav li.active a {
          color: var(--accent-primary);
          background: #eff6ff;
          border-left: 3px solid var(--accent-primary);
          margin-left: -3px;
        }
        [data-theme="dark"] .sidebar nav li.active a {
          color: #fff;
          background: linear-gradient(135deg, rgba(99, 102, 241, 0.3) 0%, rgba(139, 92, 246, 0.2) 100%);
          border: 1px solid rgba(99, 102, 241, 0.3);
          box-shadow: 0 0 20px -5px rgba(99, 102, 241, 0.3);
        }
        .menu-icon {
          margin-right: 12px;
          font-size: 16px;
        }
        .sidebar-footer {
          padding: 16px 8px;
          font-size: 11px;
          color: var(--text-muted);
          text-align: center;
          border-top: 1px solid var(--border-subtle);
          margin-top: auto;
        }
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--bg-secondary);
          transition: background 0.3s ease;
        }
        [data-theme="dark"] .main-content {
          background: transparent;
        }
        .top-bar {
          height: 64px;
          background: var(--topbar-bg);
          backdrop-filter: var(--backdrop-blur);
          border-bottom: 1px solid var(--topbar-border);
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 24px;
          position: relative;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        [data-theme="dark"] .top-bar-glow {
          position: absolute;
          bottom: 0;
          left: 10%;
          right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.5), transparent);
        }
        [data-theme="light"] .top-bar-glow {
          display: none;
        }
        .user-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .theme-toggle {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-input);
          border: 1px solid var(--border-subtle);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .theme-toggle:hover {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #fff;
          transform: scale(1.05);
        }
        [data-theme="dark"] .theme-toggle:hover {
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.4);
        }
        .user-info {
          color: var(--text-secondary);
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }
        .action-btn {
          background: var(--bg-input);
          color: var(--text-secondary);
          border: 1px solid var(--border-subtle);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .action-btn:hover {
          background: var(--accent-primary);
          color: #fff;
          border-color: var(--accent-primary);
        }
        .action-btn.logout:hover {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }
        .content {
          padding: 24px;
          flex: 1;
          overflow-y: auto;
        }
      `}</style>
    </div>
  );
}
