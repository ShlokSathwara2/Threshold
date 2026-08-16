"use client";

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, useSpring } from 'framer-motion';

interface NavItem {
  key: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const SLOT_W = 62;
const ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    label: 'Home',
    path: '/dashboard',
    icon: (
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  },
];

const PILL_W = SLOT_W - 12;
const PADDING = 5;
const RADIUS = 22;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = Math.max(
    0,
    ITEMS.findIndex((i) => pathname === i.path)
  );

  const pillX = useSpring(activeIndex * SLOT_W, { stiffness: 320, damping: 30 });
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    pillX.set(activeIndex * SLOT_W);
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 280);
    return () => window.clearTimeout(t);
  }, [activeIndex, pillX]);

  const navigate = useCallback(
    (index: number) => {
      const target = ITEMS[index];
      if (!target) return;
      if (pathname !== target.path) {
        pillX.set(index * SLOT_W);
        setPulse(true);
        window.setTimeout(() => {
          setPulse(false);
          router.push(target.path);
        }, 180);
      }
    },
    [pathname, pillX, router]
  );

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
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
          gap: '2px',
          padding: `${PADDING}px`,
          borderRadius: RADIUS,
          background: 'rgba(16, 16, 28, 0.62)',
          backdropFilter: 'blur(26px) saturate(180%)',
          WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Static indicator pill — springs to the active item, expands on change */}
        <motion.div
          style={{
            position: 'absolute',
            left: PADDING,
            top: PADDING,
            width: PILL_W,
            height: `calc(100% - ${PADDING * 2}px)`,
            borderRadius: RADIUS - 2,
            background: 'linear-gradient(135deg, rgba(139,92,246,0.95), rgba(217,70,239,0.9))',
            boxShadow: '0 4px 22px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
            border: '1px solid rgba(255,255,255,0.22)',
            x: pillX,
            scale: pulse ? 1.09 : 1,
            transition: 'scale 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        />

        {ITEMS.map((item, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={item.key}
              onClick={() => navigate(i)}
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
                padding: '8px 0 7px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: active ? 'white' : 'rgba(255,255,255,0.45)',
                transition: 'color 0.2s',
              }}
            >
              <div style={{ transform: active ? 'scale(1.05)' : undefined }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: '0.52rem',
                fontWeight: active ? 700 : 500,
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