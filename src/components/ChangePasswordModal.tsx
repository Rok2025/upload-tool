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
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 100001; /* Higher than sidebar */
            backdrop-filter: blur(4px);
            animation: fadeIn 0.3s ease;
          }

          .modal-content {
            background: #fff;
            border-radius: 12px;
            width: 100%;
            max-width: 450px;
            padding: 30px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            animation: modalShow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            color: #334155;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes modalShow {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }

          .modal-title {
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 24px;
            color: #1e293b;
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
            color: #64748b;
          }

          .form-group input {
            padding: 10px 12px;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
          }

          .form-group input:focus {
            border-color: #3b82f6;
            box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
          }

          .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 12px;
            margin-top: 8px;
          }

          .btn-primary, .btn-secondary {
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: all 0.2s;
          }

          .btn-primary {
            background: #3b82f6;
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: #2563eb;
          }

          .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .btn-secondary {
            background: #f1f5f9;
            color: #64748b;
          }

          .btn-secondary:hover {
            background: #e2e8f0;
            color: #475569;
          }
        `}</style>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
