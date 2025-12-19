import React from 'react';
import Sidebar from './Sidebar';
import './Layout.css';

import { LogOut, Settings } from 'lucide-react';

const Layout = ({ children, onLogout }) => {
    return (
        <div className="app-layout">
            <Sidebar />
            <main className="main-content">
                <header className="top-bar">
                    <h2 className="page-title">College Timetable System</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div className="avatar" style={{ background: 'var(--primary)', color: 'white' }}>A</div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Admin</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>admin@123</span>
                            </div>
                        </div>
                        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }}></div>
                        <button
                            onClick={onLogout}
                            className="btn-icon"
                            title="Sign Out"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-light)',
                                padding: '0.5rem',
                                borderRadius: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--danger)'; e.currentTarget.style.background = 'var(--bg-body)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-light)'; e.currentTarget.style.background = 'transparent'; }}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>
                <div className="content-scroll">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default Layout;
