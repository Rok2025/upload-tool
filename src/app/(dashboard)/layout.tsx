'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);

  useEffect(() => {
    setMounted(true);
    // Fetch current user role
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
    // Normalize paths - remove trailing slashes for comparison
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
        <div className="logo">Upload Tool</div>
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
      </aside>
      <main className="main-content">
        <header className="top-bar">
          <div className="user-section">
            <span className="user-info">admin</span>
            <button className="logout-btn" onClick={handleLogout}>退出登录</button>
          </div>
        </header>
        <div className="content">
          {children}
        </div>
      </main>
      <style jsx global>{`
        .app-container {
          display: flex;
          min-height: 100vh;
        }
        .sidebar {
          width: 240px;
          background: #1e293b;
          color: #f8fafc;
          padding: 20px;
          display: flex;
          flex-direction: column;
        }
        .logo {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 40px;
          color: #60a5fa;
        }
        .sidebar nav ul {
          list-style: none;
        }
        .sidebar nav li {
          padding: 0;
          margin-bottom: 4px;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .sidebar nav li a {
          color: #94a3b8;
          text-decoration: none;
          display: flex;
          align-items: center;
          padding: 12px 16px;
          border-radius: 8px;
          transition: all 0.2s;
        }
        .sidebar nav li:hover a {
          color: #f8fafc;
          background: rgba(255, 255, 255, 0.05);
        }
        .sidebar nav li.active a {
          color: #60a5fa;
          background: rgba(96, 165, 250, 0.15);
          font-weight: 500;
          border-left: 3px solid #60a5fa;
          padding-left: 13px;
        }
        .menu-icon {
          margin-right: 12px;
          font-size: 16px;
        }
        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .top-bar {
          height: 60px;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          padding: 0 24px;
        }
        .user-section {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .user-info {
          color: #64748b;
          font-size: 14px;
        }
        .logout-btn {
          background: #f1f5f9;
          color: #64748b;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .logout-btn:hover {
          background: #e2e8f0;
          color: #475569;
        }
        .content {
          padding: 24px;
          flex: 1;
        }
      `}</style>
    </div>
  );
}
