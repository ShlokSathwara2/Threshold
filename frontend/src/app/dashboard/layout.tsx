"use client";

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { isSpLoggedIn, clearSession, getSession, fetchSpProfile, checkSpSession } from '@/lib/api';
import PullRefresh from '@/components/ui/PullRefresh';
import BottomNav from '@/components/nav/BottomNav';
import BrandWord from '@/components/brand/BrandWord';
import { SubjectRegistryProvider } from '@/lib/subject-registry';
import { ThemeProvider, useTheme } from '@/lib/theme';
import Lenis from 'lenis';

const navItems = [
  { label: 'Marks', path: '/dashboard/marks', icon: '◆' },
  { label: 'CGPA Calc', path: '/dashboard/cgpa', icon: '▣' },
  { label: 'Internal Marks', path: '/dashboard/internal-marks', icon: '✸' },
  { label: 'Settings', path: '/dashboard/settings', icon: '⚙' },
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
  '/dashboard/settings': 'Settings',
};

function NoiseOverlay() {
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5,
        pointerEvents: 'none',
        opacity: 0.028,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")`,
        backgroundSize: '120px 120px',
      }}
    />
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();
  const [user, setUser] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isSpLoggedIn()) {
      router.push('/sp-login');
      return;
    }
    const session = getSession();
    if (session?.user) setUser(session.user);
    fetchSpProfile()
      .then((res) => {
        if (res.profile?.name) setUser(res.profile.name as string);
      })
      .catch(() => {
        /* keep the username fallback */
      });
  }, [router]);

  // Keepalive: probe the SP session periodically; when the cookie dies,
  // log the user out so they re-enter credentials.
  useEffect(() => {
    if (!isSpLoggedIn()) return;
    let destroyed = false;
    const checkSession = async () => {
      const { alive } = await checkSpSession();
      if (!destroyed && !alive) {
        clearSession();
        router.push('/sp-login?expired=1');
      }
    };
    const onVisible = () => {
      if (!document.hidden) checkSession();
    };
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(checkSession, 3 * 60 * 1000);
    checkSession();
    return () => {
      destroyed = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [router]);

  // Lenis smooth scroll on the scroll container
  useEffect(() => {
    const lenis = new Lenis({
      autoRaf: true,
      smoothWheel: false,
    });
    return () => {
      lenis.destroy();
    };
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push('/welcome');
  };

  const handleSwitchAccount = () => {
    router.push('/login');
  };

  return (
    <div style={{
      height: '100dvh',
      overflow: 'hidden',
      background: theme.bg,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <NoiseOverlay />

      {/* Top Bar */}
      <header style={{
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        paddingTop: 'calc(10px + env(safe-area-inset-top, 0px))',
        background: theme.headerBg,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${theme.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Menu"
            style={{
              background: 'none',
              border: 'none',
              color: theme.text,
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
            color: theme.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {pathname === '/dashboard' ? (
              <BrandWord text="THRESHOLD" fontSize="1.2rem" />
            ) : (
              pageTitles[pathname] || 'Threshold'
            )}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={handleSwitchAccount}
            style={{
              background: theme.accentDim,
              border: `1px solid ${theme.accent}4d`,
              borderRadius: '8px',
              color: theme.accentText,
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
        background: theme.bgSoft,
        borderRight: `1px solid ${theme.borderStrong}`,
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
          background: theme.accentDim,
          border: `1px solid ${theme.accent}33`,
        }}>
          <p style={{
            color: theme.text,
            fontWeight: 600,
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {user || 'Student'}
          </p>
          <p style={{
            color: theme.textFaint,
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
                border: isActive ? `1px solid ${theme.accent}40` : '1px solid transparent',
                background: isActive ? theme.accentDim : 'transparent',
                color: isActive ? theme.accentText : theme.textDim,
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
      <PullRefresh mainRef={mainRef}>
        <SubjectRegistryProvider>
          <main
            ref={mainRef}
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
            <p style={{
              textAlign: 'center',
              fontSize: '0.7rem',
              color: theme.textFaint,
              margin: '28px 0 8px',
              letterSpacing: '0.3px',
            }}>
              Made by <span style={{ fontWeight: 700, color: theme.textDim }}>Shlok Sathwara</span> ✦
            </p>
          </main>
        </SubjectRegistryProvider>
      </PullRefresh>

      {/* Bottom navigation */}
      <BottomNav />
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardShell>{children}</DashboardShell>
    </ThemeProvider>
  );
}