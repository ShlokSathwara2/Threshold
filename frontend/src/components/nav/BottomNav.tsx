"use client";

import { usePathname, useRouter } from 'next/navigation';

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

const PADDING = 5;
const RADIUS = 22;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = Math.max(
    0,
    ITEMS.findIndex((i) => pathname.replace(/\/+$/, '') === i.path)
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
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: `${PADDING}px`,
          borderRadius: 999,
          background: 'rgba(16, 16, 28, 0.62)',
          backdropFilter: 'blur(26px) saturate(180%)',
          WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
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
                width: SLOT_W,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '3px',
                padding: '8px 0 7px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: active ? '#c4b5fd' : 'rgba(255,255,255,0.45)',
                transition: 'color 0.2s',
              }}
            >
              <div style={{
                transform: active ? 'scale(1.08)' : undefined,
                filter: active ? 'drop-shadow(0 0 8px rgba(167,139,250,0.7))' : undefined,
                transition: 'transform 0.2s, filter 0.2s',
              }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: '0.52rem',
                fontWeight: active ? 700 : 500,
                letterSpacing: '0.2px',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </span>
              {/* Active indicator dot */}
              <div style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: active ? '#a78bfa' : 'transparent',
                boxShadow: active ? '0 0 8px rgba(167,139,250,0.9)' : undefined,
                transition: 'background 0.2s',
              }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}