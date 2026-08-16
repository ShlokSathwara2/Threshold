"use client";

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useSpring } from 'framer-motion';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Home',
    path: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </svg>
    ),
  },
  {
    key: 'attendance',
    label: 'Attendance',
    path: '/dashboard/attendance',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 5-6" />
      </svg>
    ),
  },
  {
    key: 'calendar',
    label: 'Calendar',
    path: '/dashboard/calendar',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </svg>
    ),
  },
  {
    key: 'timetable',
    label: 'Timetable',
    path: '/dashboard/timetable',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    key: 'profile',
    label: 'Profile',
    path: '/dashboard/profile',
    icon: (
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
];

// Sidebar-only routes — no bottom-nav item, pill must hide
const SIDEBAR_ONLY = ['/dashboard/marks', '/dashboard/cgpa', '/dashboard/internal-marks'];

const SLOT_W = 52;
const PILL_W = SLOT_W - 10;
const PADDING = 3;
const RADIUS = 14;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = ITEMS.findIndex((i) => pathname === i.path);
  const pillVisible = activeIndex >= 0 && !SIDEBAR_ONLY.includes(pathname);
  const idx = Math.max(0, activeIndex);

  const pillX = useSpring(idx * SLOT_W, { stiffness: 320, damping: 30 });

  useEffect(() => {
    pillX.set(idx * SLOT_W);
  }, [idx, pillX]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 70,
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: `${PADDING}px`,
          borderRadius: RADIUS,
          background: 'rgba(255, 255, 255, 0.07)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
        }}
      >
        {/* Active indicator pill — hidden on sidebar-only routes */}
        {pillVisible && (
          <motion.div
            style={{
              position: 'absolute',
              left: PADDING,
              top: PADDING,
              width: PILL_W,
              height: `calc(100% - ${PADDING * 2}px)`,
              borderRadius: RADIUS - 3,
              background: 'rgba(139, 92, 246, 0.28)',
              border: '1px solid rgba(167, 139, 250, 0.35)',
              boxShadow: '0 0 16px rgba(139, 92, 246, 0.25)',
              x: pillX,
            }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          />
        )}

        {ITEMS.map((item, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={item.key}
              onClick={() => {
                if (pathname !== item.path) router.push(item.path);
              }}
              aria-label={item.label}
              style={{
                position: 'relative',
                zIndex: 1,
                width: SLOT_W,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                padding: '6px 0 5px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: active ? '#e9d5ff' : 'rgba(255,255,255,0.38)',
                transition: 'color 0.2s',
              }}
            >
              <div style={{ opacity: active ? 1 : 0.75 }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: '0.48rem',
                fontWeight: active ? 600 : 400,
                letterSpacing: '0.2px',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}