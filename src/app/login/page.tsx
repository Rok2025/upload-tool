'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// 部署图标 SVG 组件 - 服务器+箭头，表达"项目部署"
function DeployIcon() {
    return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="deploy-icon">
            {/* 服务器主体 */}
            <rect x="12" y="8" width="40" height="14" rx="3" fill="url(#gradient1)" className="server-top" />
            <rect x="12" y="26" width="40" height="14" rx="3" fill="url(#gradient2)" className="server-mid" />
            <rect x="12" y="44" width="40" height="14" rx="3" fill="url(#gradient3)" className="server-bottom" />
            
            {/* 服务器指示灯 */}
            <circle cx="20" cy="15" r="2" fill="#4ade80" className="light light-1" />
            <circle cx="20" cy="33" r="2" fill="#4ade80" className="light light-2" />
            <circle cx="20" cy="51" r="2" fill="#facc15" className="light light-3" />
            
            {/* 服务器线条 */}
            <rect x="26" y="14" width="20" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="26" y="32" width="20" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
            <rect x="26" y="50" width="20" height="2" rx="1" fill="rgba(255,255,255,0.3)" />
            
            {/* 部署箭头 */}
            <path d="M56 32L64 32M64 32L58 26M64 32L58 38" stroke="url(#arrowGradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="deploy-arrow" />
            
            <defs>
                <linearGradient id="gradient1" x1="12" y1="8" x2="52" y2="22" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#3b82f6" />
                    <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="gradient2" x1="12" y1="26" x2="52" y2="40" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="gradient3" x1="12" y1="44" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#8b5cf6" />
                    <stop offset="1" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="arrowGradient" x1="56" y1="32" x2="64" y2="32" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22d3ee" />
                    <stop offset="1" stopColor="#3b82f6" />
                </linearGradient>
            </defs>
        </svg>
    );
}

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
            {/* 动态背景粒子 */}
            <div className="bg-particles">
                <div className="particle particle-1"></div>
                <div className="particle particle-2"></div>
                <div className="particle particle-3"></div>
                <div className="particle particle-4"></div>
                <div className="particle particle-5"></div>
            </div>
            
            {/* 网格背景 */}
            <div className="grid-bg"></div>

            <div className="login-card">
                <div className="card-glow"></div>
                <div className="login-header">
                    <div className="logo-container">
                        <DeployIcon />
                    </div>
                    <h1>项目部署工具</h1>
                    <p>内部运维平台</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="form-group">
                        <label>用户名</label>
                        <div className="input-wrapper">
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="请输入管理员账号"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>密码</label>
                        <div className="input-wrapper">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="请输入密码"
                                required
                            />
                        </div>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button type="submit" className="login-btn" disabled={loading}>
                        <span className="btn-text">{loading ? '正在验证...' : '立即登录'}</span>
                        <span className="btn-glow"></span>
                    </button>
                </form>

                <div className="login-footer">
                    © 2026 中科金审科技
                </div>
            </div>

            <style jsx>{`
        .login-page {
          height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
          position: fixed;
          top: 0;
          left: 0;
          z-index: 1000;
          overflow: hidden;
        }
        
        /* 网格背景 */
        .grid-bg {
          position: absolute;
          inset: 0;
          background-image: 
            linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px);
          background-size: 50px 50px;
          animation: gridMove 20s linear infinite;
        }
        @keyframes gridMove {
          0% { transform: translate(0, 0); }
          100% { transform: translate(50px, 50px); }
        }
        
        /* 浮动粒子 */
        .bg-particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .particle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, transparent 70%);
          animation: float 15s ease-in-out infinite;
        }
        .particle-1 { width: 300px; height: 300px; top: -100px; left: -100px; animation-delay: 0s; }
        .particle-2 { width: 200px; height: 200px; top: 50%; right: -50px; animation-delay: -3s; }
        .particle-3 { width: 250px; height: 250px; bottom: -80px; left: 30%; animation-delay: -6s; }
        .particle-4 { width: 150px; height: 150px; top: 20%; right: 20%; animation-delay: -9s; background: radial-gradient(circle, rgba(34, 211, 238, 0.3) 0%, transparent 70%); }
        .particle-5 { width: 180px; height: 180px; bottom: 20%; left: 10%; animation-delay: -12s; background: radial-gradient(circle, rgba(139, 92, 246, 0.3) 0%, transparent 70%); }
        
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.5; }
          25% { transform: translate(30px, -30px) scale(1.1); opacity: 0.8; }
          50% { transform: translate(-20px, 20px) scale(0.9); opacity: 0.6; }
          75% { transform: translate(20px, 10px) scale(1.05); opacity: 0.7; }
        }
        
        .login-card {
          position: relative;
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(20px);
          padding: 48px 40px;
          border-radius: 24px;
          width: 100%;
          max-width: 420px;
          border: 1px solid rgba(99, 102, 241, 0.2);
          box-shadow: 
            0 0 0 1px rgba(255, 255, 255, 0.05),
            0 25px 50px -12px rgba(0, 0, 0, 0.5),
            0 0 100px -20px rgba(99, 102, 241, 0.3);
          animation: cardAppear 0.6s ease-out;
        }
        @keyframes cardAppear {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        
        .card-glow {
          position: absolute;
          top: -1px;
          left: 20%;
          right: 20%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #6366f1, #22d3ee, #6366f1, transparent);
          border-radius: 2px;
          animation: glowPulse 3s ease-in-out infinite;
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        
        .login-header {
          text-align: center;
          margin-bottom: 36px;
        }
        .logo-container {
          display: flex;
          justify-content: center;
          margin-bottom: 20px;
        }
        .login-header h1 {
          color: #f1f5f9;
          font-size: 26px;
          margin-bottom: 8px;
          font-weight: 700;
          letter-spacing: 0.5px;
          background: linear-gradient(135deg, #f1f5f9 0%, #94a3b8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .login-header p {
          color: #64748b;
          font-size: 14px;
          letter-spacing: 2px;
        }
        
        .form-group {
          margin-bottom: 24px;
        }
        .form-group label {
          display: block;
          color: #94a3b8;
          font-size: 13px;
          margin-bottom: 8px;
          font-weight: 500;
          letter-spacing: 0.5px;
        }
        .input-wrapper {
          position: relative;
        }
        .form-group input {
          width: 100%;
          padding: 14px 18px;
          background: rgba(30, 41, 59, 0.5);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 12px;
          color: #f1f5f9;
          font-size: 15px;
          transition: all 0.3s ease;
        }
        .form-group input:focus {
          outline: none;
          border-color: #6366f1;
          background: rgba(30, 41, 59, 0.8);
          box-shadow: 
            0 0 0 3px rgba(99, 102, 241, 0.1),
            0 0 20px -5px rgba(99, 102, 241, 0.3);
        }
        .form-group input::placeholder {
          color: #475569;
        }
        
        .error-message {
          color: #f87171;
          font-size: 13px;
          margin-bottom: 16px;
          text-align: center;
          padding: 10px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        
        .login-btn {
          position: relative;
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          overflow: hidden;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 40px -10px rgba(99, 102, 241, 0.5);
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .login-btn:disabled {
          background: #475569;
          cursor: not-allowed;
        }
        .btn-text {
          position: relative;
          z-index: 1;
        }
        .btn-glow {
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          animation: btnGlow 3s ease-in-out infinite;
        }
        @keyframes btnGlow {
          0% { left: -100%; }
          50%, 100% { left: 100%; }
        }
        
        .login-footer {
          margin-top: 36px;
          text-align: center;
          color: #475569;
          font-size: 12px;
          letter-spacing: 1px;
        }
      `}</style>

            <style jsx global>{`
        /* SVG 图标动画 */
        .deploy-icon .server-top {
          animation: serverPulse 2s ease-in-out infinite;
        }
        .deploy-icon .server-mid {
          animation: serverPulse 2s ease-in-out infinite 0.2s;
        }
        .deploy-icon .server-bottom {
          animation: serverPulse 2s ease-in-out infinite 0.4s;
        }
        @keyframes serverPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        
        .deploy-icon .light {
          animation: lightBlink 1.5s ease-in-out infinite;
        }
        .deploy-icon .light-1 { animation-delay: 0s; }
        .deploy-icon .light-2 { animation-delay: 0.3s; }
        .deploy-icon .light-3 { animation-delay: 0.6s; }
        @keyframes lightBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        
        .deploy-icon .deploy-arrow {
          animation: arrowMove 1.5s ease-in-out infinite;
        }
        @keyframes arrowMove {
          0%, 100% { transform: translateX(0); opacity: 1; }
          50% { transform: translateX(3px); opacity: 0.7; }
        }
      `}</style>
        </div>
    );
}
