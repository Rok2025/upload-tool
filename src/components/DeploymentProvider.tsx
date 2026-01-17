'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';

interface DeploymentContextType {
    activeDeployments: any[];
}

const DeploymentContext = createContext<DeploymentContextType>({ activeDeployments: [] });

export const useDeployment = () => useContext(DeploymentContext);

export function DeploymentProvider({ children }: { children: React.ReactNode }) {
    const [activeDeployments, setActiveDeployments] = useState<any[]>([]);
    const notifiedRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const res = await fetch('/api/deploy/status');
                if (res.ok) {
                    const data = await res.json();

                    // Filter for context (only running ones needed for UI progress usually)
                    const running = data.filter((d: any) => d.status === 'deploying');
                    setActiveDeployments(running);

                    // Notification Logic
                    data.forEach((d: any) => {
                        if (notifiedRef.current.has(d.id)) return;

                        if (d.status === 'success') {
                            toast.custom((t) => (
                                <div
                                    onClick={() => toast.dismiss(t.id)}
                                    style={{
                                        opacity: t.visible ? 1 : 0,
                                        transform: t.visible ? 'translateY(0)' : 'translateY(-20px)',
                                        transition: 'all 0.3s ease',
                                        background: 'white',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        borderLeft: '5px solid #10b981',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '15px',
                                        cursor: 'pointer',
                                        minWidth: '320px',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                                    }}
                                >
                                    <div style={{ fontSize: '24px', marginTop: '-2px' }}>🚀</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '800', fontSize: '16px', color: '#0f172a', marginBottom: '4px' }}>部署成功</div>
                                        <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                                            <span style={{ color: '#64748b' }}>项目:</span> <b>{d.project_name}</b><br />
                                            <span style={{ color: '#64748b' }}>模块:</span> <b>{d.module_name}</b>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>点击卡片关闭提醒</div>
                                    </div>
                                </div>
                            ), { duration: Infinity, position: 'top-right' });
                            notifiedRef.current.add(d.id);
                        } else if (d.status === 'failed') {
                            toast.custom((t) => (
                                <div
                                    onClick={() => toast.dismiss(t.id)}
                                    style={{
                                        opacity: t.visible ? 1 : 0,
                                        transform: t.visible ? 'translateY(0)' : 'translateY(-20px)',
                                        transition: 'all 0.3s ease',
                                        background: 'white',
                                        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                                        borderRadius: '12px',
                                        padding: '16px 20px',
                                        borderLeft: '5px solid #ef4444',
                                        display: 'flex',
                                        alignItems: 'flex-start',
                                        gap: '15px',
                                        cursor: 'pointer',
                                        minWidth: '320px',
                                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
                                    }}
                                >
                                    <div style={{ fontSize: '24px', marginTop: '-2px' }}>❌</div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '800', fontSize: '16px', color: '#0f172a', marginBottom: '4px' }}>部署失败</div>
                                        <div style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5' }}>
                                            <span style={{ color: '#64748b' }}>项目:</span> <b>{d.project_name}</b><br />
                                            <span style={{ color: '#64748b' }}>模块:</span> <b>{d.module_name}</b>
                                        </div>
                                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>点击查看详情</div>
                                    </div>
                                </div>
                            ), { duration: 5000, position: 'top-right' });
                            notifiedRef.current.add(d.id);
                        } else if (d.status === 'deploying') {
                            // Optional: mark as "seen" so we don't notify "Started" (unless we want to)
                            // For now, we only notify on completion.
                            // We also don't add to notifiedRef for running, so we can track it when it finishes.
                        }
                    });
                }
            } catch (e) {
                console.error("Failed to poll deployment status", e);
            }
        };

        // Initial fetch
        fetchStatus();

        // Poll every 3 seconds
        const interval = setInterval(fetchStatus, 3000);

        return () => clearInterval(interval);
    }, []);

    return (
        <DeploymentContext.Provider value={{ activeDeployments }}>
            {children}
            <Toaster />
        </DeploymentContext.Provider>
    );
}
