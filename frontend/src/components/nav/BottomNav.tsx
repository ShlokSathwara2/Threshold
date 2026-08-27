"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTheme, hexToRgba } from '@/lib/theme';
import { isCampusWebSession } from '@/lib/api';
import FeatureLockModal from '@/components/dashboard/FeatureLockModal';

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

const PILL_PADDING = 6;

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useTheme();
  const [lockModal, setLockModal] = useState<{ show: boolean; feature?: string }>({ show: false });

  const activeIndex = Math.max(
    0,
    ITEMS.findIndex((i) => pathname.replace(/\/+$/, '') === i.path)
  );

  return (
    <>
    <FeatureLockModal show={lockModal.show} feature={lockModal.feature} onClose={() => setLockModal({ show: false })} />
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(330px, calc(100vw - 32px))',
        zIndex: 70,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: `${PILL_PADDING}px`,
          borderRadius: 999,
          background: theme.isLight ? 'rgba(255,255,255,0.82)' : 'rgba(16, 16, 28, 0.66)',
          backdropFilter: 'blur(26px) saturate(180%)',
          WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          border: `1px solid ${theme.isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'}`,
          boxShadow: `0 12px 44px ${theme.isLight ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.55)'}, inset 0 1px 0 ${theme.isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.12)'}`,
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
                if (item.key === 'profile' && isCampusWebSession()) {
                  setLockModal({ show: true, feature: 'Profile' });
                  return;
                }
                if (pathname !== item.path) router.push(item.path);
              }}
              aria-label={item.label}
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                justifyContent: 'center',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                position: 'relative',
              }}
            >
              {/* Inset capsule — breathing room on every side means it can
                  never merge with the pill's rounded side sections */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '3px',
                  width: '100%',
                  padding: '8px 0 7px',
                  borderRadius: 999,
                  background: active
                    ? `linear-gradient(135deg, ${theme.accent} 0%, ${hexToRgba(theme.accent, 0.72)} 100%)`
                    : 'transparent',
                  boxShadow: active
                    ? `0 6px 20px ${hexToRgba(theme.accent, 0.45)}, inset 0 1px 0 rgba(255,255,255,0.22)`
                    : 'none',
                  transform: active ? 'scale(1.02)' : 'scale(1)',
                  transition: 'background 0.25s ease, box-shadow 0.25s ease, transform 0.2s ease',
                }}
              >
                <div style={{
                  color: active ? '#fff' : theme.textFaint,
                  filter: active ? `drop-shadow(0 0 7px ${hexToRgba(theme.accent, 0.8)})` : undefined,
                  transition: 'color 0.2s, filter 0.2s',
                  display: 'flex',
                  position: 'relative',
                }}>
                  {item.icon}
                  {item.key === 'profile' && isCampusWebSession() && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      fontSize: '0.5rem',
                      lineHeight: 1,
                    }}>🔒</span>
                  )}
                </div>
                <span style={{
                  fontSize: '0.52rem',
                  fontWeight: active ? 700 : 500,
                  letterSpacing: '0.2px',
                  color: active ? '#fff' : theme.textFaint,
                  textShadow: active ? '0 1px 2px rgba(0,0,0,0.35)' : undefined,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s',
                }}>
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
    </>
  );
}