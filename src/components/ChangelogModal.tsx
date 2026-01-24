'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Change {
    type: 'feat' | 'fix' | 'perf' | 'docs' | 'breaking';
    desc: string;
}

interface Version {
    version: string;
    date: string;
    title: string;
    changes: Change[];
}

interface ChangelogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const typeIcons: Record<string, { icon: string; label: string }> = {
    feat: { icon: '✨', label: '新功能' },
    fix: { icon: '🐛', label: '修复' },
    perf: { icon: '⚡', label: '优化' },
    docs: { icon: '📝', label: '文档' },
    breaking: { icon: '⚠️', label: '重要变更' }
};

export function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetch('/changelog.json')
                .then(res => res.json())
                .then(data => {
                    setVersions(data.versions || []);
                    setLoading(false);
                })
                .catch(() => {
                    setLoading(false);
                });
        }
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div className="modal-overlay" onClick={onClose}>
            <div className="changelog-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>📋 版本更新记录</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    {loading ? (
                        <div className="loading">加载中...</div>
                    ) : versions.length === 0 ? (
                        <div className="empty">暂无版本记录</div>
                    ) : (
                        <div className="version-list">
                            {versions.map((v, idx) => (
                                <div key={v.version} className={`version-item ${idx === 0 ? 'latest' : ''}`}>
                                    <div className="version-header">
                                        <div className="version-info">
                                            <span className="version-tag">v{v.version}</span>
                                            {idx === 0 && <span className="latest-badge">当前版本</span>}
                                        </div>
                                        <span className="version-date">{v.date}</span>
                                    </div>
                                    <h3 className="version-title">{v.title}</h3>
                                    <ul className="change-list">
                                        {v.changes.map((change, i) => (
                                            <li key={i} className={`change-item ${change.type}`}>
                                                <span className="change-icon">{typeIcons[change.type]?.icon || '•'}</span>
                                                <span className="change-desc">{change.desc}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-close" onClick={onClose}>关闭</button>
                </div>

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
                        animation: fadeIn 0.2s ease;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    .changelog-modal {
                        background: var(--bg-card);
                        backdrop-filter: var(--backdrop-blur);
                        border-radius: 16px;
                        width: 100%;
                        max-width: 560px;
                        max-height: 80vh;
                        display: flex;
                        flex-direction: column;
                        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                        animation: modalShow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        border: 1px solid var(--border-subtle);
                        overflow: hidden;
                    }

                    @keyframes modalShow {
                        from { opacity: 0; transform: scale(0.95) translateY(10px); }
                        to { opacity: 1; transform: scale(1) translateY(0); }
                    }

                    .modal-header {
                        padding: 20px 24px;
                        border-bottom: 1px solid var(--border-subtle);
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        background: var(--bg-card);
                    }

                    [data-theme="dark"] .modal-header {
                        background: rgba(30, 41, 59, 0.5);
                    }

                    .modal-header h2 {
                        font-size: 18px;
                        font-weight: 700;
                        color: var(--text-primary);
                        margin: 0;
                    }

                    .close-btn {
                        background: none;
                        border: none;
                        color: var(--text-muted);
                        font-size: 20px;
                        cursor: pointer;
                        padding: 4px 8px;
                        border-radius: 6px;
                        transition: all 0.2s;
                    }

                    .close-btn:hover {
                        background: rgba(248, 113, 113, 0.1);
                        color: var(--error);
                    }

                    .modal-body {
                        flex: 1;
                        overflow-y: auto;
                        padding: 24px;
                    }

                    .loading, .empty {
                        text-align: center;
                        padding: 48px;
                        color: var(--text-muted);
                    }

                    .version-list {
                        display: flex;
                        flex-direction: column;
                        gap: 24px;
                    }

                    .version-item {
                        padding: 20px;
                        border-radius: 12px;
                        background: var(--bg-input);
                        border: 1px solid var(--border-subtle);
                        transition: all 0.2s;
                    }

                    .version-item.latest {
                        border-color: var(--accent-primary);
                        box-shadow: 0 0 0 1px var(--accent-primary);
                    }

                    [data-theme="dark"] .version-item.latest {
                        box-shadow: var(--shadow-glow);
                    }

                    .version-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }

                    .version-info {
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .version-tag {
                        font-size: 14px;
                        font-weight: 700;
                        color: var(--accent-primary);
                        background: rgba(99, 102, 241, 0.1);
                        padding: 4px 10px;
                        border-radius: 6px;
                        font-family: monospace;
                    }

                    .latest-badge {
                        font-size: 10px;
                        font-weight: 600;
                        color: #fff;
                        background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
                        padding: 3px 8px;
                        border-radius: 10px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    }

                    .version-date {
                        font-size: 13px;
                        color: var(--text-muted);
                    }

                    .version-title {
                        font-size: 16px;
                        font-weight: 600;
                        color: var(--text-primary);
                        margin: 0 0 12px 0;
                    }

                    .change-list {
                        list-style: none;
                        padding: 0;
                        margin: 0;
                        display: flex;
                        flex-direction: column;
                        gap: 8px;
                    }

                    .change-item {
                        display: flex;
                        align-items: flex-start;
                        gap: 10px;
                        font-size: 14px;
                        color: var(--text-secondary);
                        line-height: 1.5;
                    }

                    .change-icon {
                        flex-shrink: 0;
                        width: 20px;
                        text-align: center;
                    }

                    .change-desc {
                        flex: 1;
                    }

                    .modal-footer {
                        padding: 16px 24px;
                        border-top: 1px solid var(--border-subtle);
                        display: flex;
                        justify-content: flex-end;
                    }

                    .btn-close {
                        background: var(--bg-input);
                        color: var(--text-secondary);
                        border: 1px solid var(--border-subtle);
                        padding: 10px 24px;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        transition: all 0.2s;
                    }

                    .btn-close:hover {
                        background: var(--accent-primary);
                        color: #fff;
                        border-color: var(--accent-primary);
                    }
                `}</style>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}
