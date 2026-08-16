"use client";

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { isSpLoggedIn, clearSession, getSession } from '@/lib/api';
import BottomNav from '@/components/nav/BottomNav';
import FluidGlassLens from '@/components/effects/FluidGlassLens';

const navItems = [
  { label: 'Marks', path: '/dashboard/marks', icon: '◆' },
  { label: 'CGPA Calc', path: '/dashboard/cgpa', icon: '▣' },
  { label: 'Internal Marks', path: '/dashboard/internal-marks', icon: '✸' },
];

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/attendance': 'Attendance',
  '/dashboard/marks': 'Marks',
  '/dashboard/cgpa': 'CGPA Calculator',
  '/dashboard/internal-marks': 'Internal Marks',
  '/dashboard/timetable': 'Timetable',
  '/dashboard/calendar': 'Calendar',
  '/dashboard/profile': 'Profile',
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isSpLoggedIn()) {
      router.push('/sp-login');
      return;
    }
    const session = getSession();
    if (session?.user) setUser(session.user);
  }, [router]);

  const handleLogout = () => {
    clearSession();
    router.push('/sp-login');
  };

  const handleSwitchAccount = () => {
    router.push('/login');
  };

  return (
    <div style={{
      height: '100dvh',
      overflow: 'hidden',
      background: '#09090f',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top Bar */}
      <header style={{
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
        background: 'rgba(9, 9, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menu"
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              fontSize: '1.15rem',
              lineHeight: 1,
              cursor: 'pointer',
              padding: '8px',
              marginLeft: '-8px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {sidebarOpen ? '✕' : '☰'}
          </button>
          <h1 style={{
            fontSize: '1.05rem',
            fontWeight: 700,
            color: 'white',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {pageTitles[pathname] || 'Threshold'}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleSwitchAccount}
            style={{
              background: 'rgba(139, 92, 246, 0.15)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              color: '#a78bfa',
              fontSize: '0.72rem',
              padding: '6px 10px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Switch
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              fontSize: '0.72rem',
              padding: '6px 10px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 45,
            background: 'rgba(0,0,0,0.6)',
          }}
        />
      )}

      {/* Sidebar */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: sidebarOpen ? 0 : '-280px',
        width: '272px',
        height: '100dvh',
        zIndex: 60,
        background: 'rgba(13, 13, 28, 0.98)',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        padding: 'calc(20px + env(safe-area-inset-top, 0px)) 14px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        transition: 'left 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
      }}>
        {/* Signed-in user chip */}
        <div style={{
          padding: '12px 14px',
          marginBottom: '12px',
          borderRadius: '12px',
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
        }}>
          <p style={{
            color: 'white',
            fontWeight: 600,
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {user || 'Student'}
          </p>
          <p style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: '0.68rem',
            marginTop: '2px',
          }}>
            Signed in • Student Portal
          </p>
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => {
                router.push(item.path);
                setSidebarOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '13px 14px',
                borderRadius: '12px',
                border: isActive ? '1px solid rgba(139, 92, 246, 0.25)' : '1px solid transparent',
                background: isActive ? 'rgba(139, 92, 246, 0.18)' : 'transparent',
                color: isActive ? '#c4b5fd' : 'rgba(255,255,255,0.55)',
                fontSize: '0.9rem',
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
              {item.label}
            </button>
          );
        })}

      </nav>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: '10px 16px',
          paddingBottom: 'calc(104px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {children}
      </main>

      {/* True 3D fluid glass backdrop (pointer-events none) */}
      <FluidGlassLens />

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}
