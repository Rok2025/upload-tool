'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'react-hot-toast';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('两次输入的密码不一致');
            return;
        }

        if (newPassword.length < 6) {
            toast.error('密码长度至少为6位');
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    oldPassword,
                    newPassword,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error === 'Incorrect old password' ? '原密码错误' : '修改密码失败');
            }

            toast.success('密码修改成功');
            onClose();
            // Reset form
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const modalContent = (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal-title">修改密码</h2>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label>当前密码</label>
                        <input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                            placeholder="请输入当前密码"
                        />
                    </div>

                    <div className="form-group">
                        <label>新密码</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="请输入新密码 (至少6位)"
                        />
                    </div>

                    <div className="form-group">
                        <label>确认新密码</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            placeholder="请再次输入新密码"
                        />
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                            disabled={isLoading}
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={isLoading}
                        >
                            {isLoading ? '正在提交...' : '确认修改'}
                        </button>
                    </div>
                </form>

                <style jsx global>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(15, 23, 42, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100001;
            backdrop-filter: blur(8px);
            animation: fadeIn 0.3s ease;
          }

          .modal-content {
            background: var(--bg-card);
            backdrop-filter: var(--backdrop-blur);
            border-radius: 16px;
            width: 100%;
            max-width: 450px;
            padding: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            animation: modalShow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            color: var(--text-primary);
            border: 1px solid var(--border-subtle);
            position: relative;
          }

          .modal-content::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary), var(--accent-primary));
            border-radius: 16px 16px 0 0;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes modalShow {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }

          .modal-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 24px;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .modal-title::before {
            content: '🔐';
          }

          .modal-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .form-group label {
            font-size: 14px;
            font-weight: 500;
            color: var(--text-secondary);
          }

          .form-group input {
            padding: 12px 14px;
            border: 1px solid var(--border-subtle);
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
            background: var(--bg-input);
            color: var(--text-primary);
          }

          .form-group input::placeholder {
            color: var(--text-muted);
          }

          .form-group input:focus {
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2);
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 8px;
          }

          .btn-primary, .btn-secondary {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
            position: relative;
            overflow: hidden;
          }

          .btn-primary {
            background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
            color: white;
          }

          .btn-primary::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
          }

          .btn-primary:hover:not(:disabled)::after {
            left: 100%;
          }

          .btn-primary:hover:not(:disabled) {
            box-shadow: var(--shadow-glow);
            transform: translateY(-1px);
          }

          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: var(--bg-input);
            color: var(--text-secondary);
            border: 1px solid var(--border-subtle);
          }

          .btn-secondary:hover:not(:disabled) {
            background: rgba(51, 65, 85, 0.8);
            border-color: var(--accent-primary);
            color: var(--text-primary);
          }
        `}</style>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
