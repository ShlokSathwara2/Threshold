"use client";

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { App } from '@capacitor/app';
import { isSpLoggedIn, clearSession, getSession, fetchSpProfile, checkSpSession, upgradeSessionUser, clearAcademiaCookies } from '@/lib/api';
import { clearAllScopedData } from '@/lib/user-scope';
import PullRefresh from '@/components/ui/PullRefresh';
import AppLockGate from '@/components/ui/AppLockGate';
import BottomNav from '@/components/nav/BottomNav';
import BrandWord from '@/components/brand/BrandWord';
import { SubjectRegistryProvider } from '@/lib/subject-registry';
import { ThemeProvider, useTheme, overlay, overlayBg } from '@/lib/theme';
import { checkForUpdate, notifyUpdate, type UpdateInfo } from '@/lib/update-check';
import UpdatePrompt from '@/components/dashboard/UpdatePrompt';
import WelcomeModal from '@/components/dashboard/WelcomeModal';
import Lenis from 'lenis';

// "ra2411003010247@srmist.edu.in" → "Ra2411003010247"
// "SHLOK KUMAR" → "Shlok Kumar"
function prettifyName(raw: string): string {
  const base = (raw || '').split('@')[0].trim();
  if (!base) return 'Student';
  const cleaned = base.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) return 'Student';
  return cleaned
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const navContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.08 } },
};

const navItemAnim = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.28, ease: 'easeOut' as const } },
};

type NavItem = { label: string; path: string; icon: string };
type NavGroup = {
  label: string;
  items: NavItem[];
  expandable?: boolean;
};

const navGroups: NavGroup[] = [
  {
    label: 'Academics',
    items: [
      { label: 'Marks', path: '/dashboard/marks', icon: '◆' },
      { label: 'CGPA Calc', path: '/dashboard/cgpa', icon: '▣' },
      { label: 'Internal Marks', path: '/dashboard/internal-marks', icon: '✸' },
      { label: 'Course Status', path: '/dashboard/course-status', icon: '✓' },
    ],
  },
  {
    label: 'Examination',
    expandable: true,
    items: [
      { label: 'Hall Ticket', path: '/dashboard/exam/hall-ticket', icon: '⚑' },
      { label: 'Exam Timetable', path: '/dashboard/exam/timetable', icon: '▧' },
      { label: 'Provisional Results', path: '/dashboard/exam/provisional-results', icon: '★' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { label: 'Analytics', path: '/dashboard/analytics', icon: '◉' },
      { label: 'Insights', path: '/dashboard/insights', icon: '🧭' },
    ],
  },
  {
    label: 'Helper',
    expandable: true,
    items: [
      { label: 'Resources', path: '/dashboard/helper/resources', icon: '◈' },
      { label: 'Study Plus', path: '/dashboard/helper/study-plus', icon: '⚒' },
    ],
  },
  {
    label: 'App',
    items: [
      { label: 'Settings', path: '/dashboard/settings', icon: '⚙' },
      { label: 'About Me', path: '/dashboard/about', icon: '✦' },
    ],
  },
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
  '/dashboard/about': 'About Me',
  '/dashboard/course-status': 'Course Status',
  '/dashboard/exam/hall-ticket': 'Hall Ticket',
  '/dashboard/exam/timetable': 'Exam Timetable',
  '/dashboard/exam/provisional-results': 'Provisional Results',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/insights': 'Insights',
  '/dashboard/helper/resources': 'Resources',
  '/dashboard/helper/study-plus': 'Study Plus',
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
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [user, setUser] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [examOpen, setExamOpen] = useState(false);
  const [helperOpen, setHelperOpen] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const navScrollRef = useRef<HTMLDivElement | null>(null);

  // In-app update check: runs on every dashboard page, re-checks every few
  // minutes, on app resume and when the app returns to the foreground, so
  // users with an installed build get notified (popup + native notification)
  // as soon as a new release is published — once per version.
  useEffect(() => {
    let disposed = false;
    const check = () => {
      if (disposed) return;
      checkForUpdate().then((info) => {
        if (disposed || !info) return;
        setUpdateInfo((prev) => (prev?.version === info.version ? prev : info));
        void notifyUpdate(info);
      });
    };
    check();
    const timer = window.setInterval(check, 5 * 60 * 1000);
    const onVisible = () => {
      if (!document.hidden) check();
    };
    document.addEventListener('visibilitychange', onVisible);
    App.addListener('resume', check)
      .then((handle) => {
        if (disposed) handle.remove();
      })
      .catch(() => {
        /* not on native — no-op */
      });
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Keep the sidebar's active/expanded section in view: when the sidebar
  // opens (or the Examination group expands), scroll the scroll container so
  // the highlighted item is never hidden below the fold.
  useEffect(() => {
    if (!sidebarOpen) return;
    const t = window.setTimeout(() => {
      const el = navScrollRef.current;
      if (!el) return;
      const active = el.querySelector<HTMLElement>('[data-active="true"]');
      const target = active ?? (examOpen ? el.querySelector<HTMLElement>('[data-exam-toggle="true"]') : helperOpen ? el.querySelector<HTMLElement>('[data-helper-toggle="true"]') : null);
      if (!target) return;
      const top = target.offsetTop;
      const bottom = top + target.offsetHeight;
      if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) {
        el.scrollTo({ top: Math.max(0, top - 14), behavior: 'smooth' });
      }
    }, 420);
    return () => window.clearTimeout(t);
    }, [sidebarOpen, examOpen, helperOpen, pathname]);

  useEffect(() => {
    if (pathname.startsWith('/dashboard/exam/')) setExamOpen(true);
    if (pathname.startsWith('/dashboard/helper/')) setHelperOpen(true);
  }, [pathname]);

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
        // Offline logins may have been keyed to the shared placeholder —
        // once the profile reveals the reg number, re-key the session so
        // every local store is per-login.
        if (res.profile?.reg_number) upgradeSessionUser(res.profile.reg_number);
      })
      .catch(() => {
        /* keep the username fallback */
      });
  }, [router]);

  // Keepalive: probe the SP session periodically; when the cookie dies,
  // keep the last screen + data visible and surface a floating popup so the
  // user can tap through to re-sign-in (no forced logout / redirect).
  const [sessionExpired, setSessionExpired] = useState(false);
  useEffect(() => {
    if (!isSpLoggedIn()) return;
    let destroyed = false;
    let expired = false;
    const checkSession = async () => {
      if (expired) return;
      const { alive } = await checkSpSession();
      if (!destroyed && !alive && !expired) {
        expired = true;
        setSessionExpired(true);
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

  const handleSessionExpiredTap = () => {
    clearSession();
    router.push('/login?expired=1');
  };

  // Deep links: threshold://attendance, threshold://subject/{code},
  // threshold://timetable, threshold://marks, threshold://exams
  useEffect(() => {
    let disposed = false;
    App.addListener('appUrlOpen', (e: { url: string }) => {
      try {
        const url = new URL(e.url);
        const p = url.pathname;
        if (p === '/attendance') router.push('/dashboard/attendance');
        else if (p === '/timetable') router.push('/dashboard/timetable');
        else if (p === '/marks') router.push('/dashboard/marks');
        else if (p === '/exams') router.push('/dashboard/exams');
        else if (p.startsWith('/subject/')) {
          const code = decodeURIComponent(p.slice('/subject/'.length));
          router.push(`/dashboard/attendance?code=${encodeURIComponent(code)}`);
        }
      } catch {
        /* malformed url — ignore */
      }
    })
      .then((handle) => {
        if (disposed) handle.remove();
      })
      .catch(() => {
        /* not on native — no-op */
      });
    return () => {
      disposed = true;
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
    clearAllScopedData();
    clearAcademiaCookies();
    router.push('/welcome');
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src="/logo.png"
                  alt="Threshold"
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                  }}
                />
                <BrandWord text="THRESHOLD" fontSize="1.2rem" />
              </div>
            ) : (
              pageTitles[pathname] || 'Threshold'
            )}
          </h1>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={() => router.push('/dashboard/internal-marks')}
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
            Internal Marks
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
        overflow: 'hidden',
        transition: 'left 0.3s cubic-bezier(0.23, 1, 0.32, 1)',
      }}>
        {/* Signed-in user chip */}
        <motion.div
          variants={navItemAnim}
          style={{
            padding: '12px 14px',
            marginBottom: '12px',
            borderRadius: '12px',
            background: theme.accentDim,
            border: `1px solid ${theme.accent}33`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{
            flexShrink: 0,
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: theme.accent,
            color: '#fff',
            fontSize: '0.85rem',
            fontWeight: 800,
            border: `2px solid ${theme.accent}66`,
          }}>
            {(prettifyName(user) || 'S').charAt(0).toUpperCase()}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              color: theme.text,
              fontWeight: 700,
              fontSize: '0.85rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              margin: 0,
            }}>
              {prettifyName(user)}
            </p>
            <p style={{
              color: theme.textFaint,
              fontSize: '0.66rem',
              marginTop: '2px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user.includes('@') ? user : 'Signed in • Student Portal'}
            </p>
          </div>
        </motion.div>

        <motion.div
          key={sidebarOpen ? 'open' : 'closed'}
          ref={navScrollRef}
          variants={navContainer}
          initial="hidden"
          animate={sidebarOpen ? 'show' : 'hidden'}
          style={{
            flex: '1 1 0%',
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            paddingBottom: '120px',
          }}
        >
        {navGroups.map((group) => {
          const groupActive = group.items.some(
            (i) => pathname === i.path || pathname.startsWith(i.path + '/')
          );
          const isOpen = !group.expandable || (group.label === 'Examination' ? examOpen : helperOpen);
          return (
            <motion.div key={group.label} variants={navItemAnim}>
              {group.expandable ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    if (group.label === 'Examination') setExamOpen(!examOpen);
                    else if (group.label === 'Helper') setHelperOpen(!helperOpen);
                  }}
                  data-exam-toggle="true"
                  data-helper-toggle={group.label === 'Helper' ? 'true' : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '13px 14px',
                    borderRadius: '12px',
                    border: groupActive ? `1px solid ${theme.accent}40` : '1px solid transparent',
                    background: groupActive ? theme.accentDim : 'transparent',
                    color: groupActive ? theme.accentText : theme.textDim,
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    width: '100%',
                  }}
                >
                  <span style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}>⚑</span>
                  {group.label}
                  <motion.span
                    animate={{ rotate: examOpen ? 90 : 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{ marginLeft: 'auto', fontSize: '0.7rem', color: W(0.4), display: 'inline-block' }}
                  >▶</motion.span>
                </motion.button>
              ) : (
                <p style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  letterSpacing: '1.2px',
                  textTransform: 'uppercase',
                  color: W(0.32),
                  margin: '16px 14px 6px',
                }}>
                  {group.label}
                </p>
              )}

              {group.expandable ? (
                <motion.div
                  initial={false}
                  animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                  transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  {group.items.map((item) => {
                    const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                    return (
                      <motion.button
                        key={item.path}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          router.push(item.path);
                          setSidebarOpen(false);
                        }}
                        data-active={isActive ? 'true' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '11px 14px 11px 40px',
                          borderRadius: '12px',
                          border: isActive ? `1px solid ${theme.accent}40` : '1px solid transparent',
                          background: isActive ? theme.accentDim : 'transparent',
                          color: isActive ? theme.accentText : theme.textDim,
                          fontSize: '0.86rem',
                          fontWeight: isActive ? 600 : 400,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%',
                        }}
                      >
                        <motion.span
                          animate={isActive ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                          transition={{ duration: 0.35 }}
                          style={{ fontSize: '0.95rem', width: '18px', textAlign: 'center', flexShrink: 0 }}
                        >{item.icon}</motion.span>
                        {item.label}
                      </motion.button>
                    );
                  })}
                </motion.div>
              ) : (
                group.items.map((item) => {
                  const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
                  return (
                    <motion.button
                      key={item.path}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => {
                        router.push(item.path);
                        setSidebarOpen(false);
                      }}
                      data-active={isActive ? 'true' : undefined}
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
                        width: '100%',
                      }}
                    >
                      <motion.span
                        animate={isActive ? { scale: [1, 1.35, 1] } : { scale: 1 }}
                        transition={{ duration: 0.35 }}
                        style={{ fontSize: '1rem', width: '20px', textAlign: 'center', flexShrink: 0 }}
                      >{item.icon}</motion.span>
                      {item.label}
                    </motion.button>
                  );
                })
              )}
            </motion.div>
          );
        })}
        </motion.div>

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
          </main>
        </SubjectRegistryProvider>
      </PullRefresh>

      {/* Bottom navigation */}
      <BottomNav />

      {/* App-level lock gate (biometric / PIN) */}
      <AppLockGate />

      {/* First-time welcome modal */}
      <WelcomeModal />

      {/* New version available — global popup on every dashboard page */}
      <UpdatePrompt info={updateInfo} onClose={() => setUpdateInfo(null)} />

      {/* Session timeout popup — keeps last screen/data visible, tap to re-sign-in */}
      {sessionExpired && (
        <motion.button
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleSessionExpiredTap}
          style={{
            position: 'fixed',
            left: '16px',
            right: '16px',
            bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
            zIndex: 900,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '16px',
            border: '1px solid rgba(245, 158, 11, 0.45)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.16), rgba(245,158,11,0.05))',
            color: 'var(--threshold-text)',
            cursor: 'pointer',
            boxShadow: '0 10px 32px rgba(0,0,0,0.45), 0 0 24px rgba(245,158,11,0.18)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            textAlign: 'left',
          }}
        >
          <span style={{
            flexShrink: 0,
            width: '34px',
            height: '34px',
            borderRadius: '11px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(245,158,11,0.2)',
            border: '1px solid rgba(245,158,11,0.35)',
            fontSize: '1rem',
          }}>
            ⚠
          </span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700 }}>
              Session timed out
            </span>
            <span style={{ display: 'block', fontSize: '0.7rem', color: W(0.55), marginTop: '1px' }}>
              Tap to sign in again — your data above is still from before.
            </span>
          </span>
          <span style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 700, color: '#fbbf24' }}>
            Sign in →
          </span>
        </motion.button>
      )}
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