'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok) {
                router.push('/');
                router.refresh();
            } else {
                setError(data.error || '登录失败，请检查用户名和密码');
            }
        } catch (err) {
            setError('网络错误，请稍后再试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="logo-icon">🚀</div>
                    <h1>Upload Tool</h1>
                    <p>自动化发布与部署中心</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>用户名</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="请输入管理员账号"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>密码</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码"
                            required
                        />
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? '正在验证...' : '立即登录'}
                    </button>
                </form>

                <div className="login-footer">
                    &copy; 2026 Antigravity Deployment Engine
                </div>
            </div>

            <style jsx>{`
        .login-page {
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          position: fixed;
          top: 0;
          left: 0;
          z-index: 1000;
        }
        .login-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          padding: 40px;
          border-radius: 20px;
          width: 100%;
          max-width: 400px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .logo-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }
        .login-header h1 {
          color: #fff;
          font-size: 24px;
          margin-bottom: 8px;
        }
        .login-header p {
          color: #94a3b8;
          font-size: 14px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        .form-group label {
          display: block;
          color: #e2e8f0;
          font-size: 14px;
          margin-bottom: 8px;
        }
        .form-group input {
          width: 100%;
          padding: 12px 16px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: #fff;
          transition: all 0.2s;
        }
        .form-group input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
        }
        .error-message {
          color: #ef4444;
          font-size: 13px;
          margin-bottom: 16px;
          text-align: center;
        }
        .login-btn {
          width: 100%;
          padding: 12px;
          background: #3b82f6;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .login-btn:hover {
          background: #2563eb;
        }
        .login-btn:disabled {
          background: #64748b;
          cursor: not-allowed;
        }
        .login-footer {
          margin-top: 32px;
          text-align: center;
          color: #475569;
          font-size: 12px;
        }
      `}</style>
        </div>
    );
}
