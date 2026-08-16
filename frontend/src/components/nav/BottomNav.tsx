"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
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

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  const activeIndex = Math.max(
    0,
    ITEMS.findIndex((i) => pathname === i.path)
  );

  const pillX = useSpring(activeIndex * SLOT_W, { stiffness: 380, damping: 32 });
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);
  const [pulse, setPulse] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startPillRef = useRef(activeIndex * SLOT_W);
  const movedRef = useRef(false);
  const lastIndexRef = useRef(activeIndex);

  useEffect(() => {
    lastIndexRef.current = activeIndex;
    if (!dragging) {
      pillX.set(activeIndex * SLOT_W);
    }
  }, [activeIndex, dragging, pillX]);

  const navigate = useCallback((index: number) => {
    const target = ITEMS[index];
    if (!target) return;
    setPulse(true);
    window.setTimeout(() => setPulse(false), 260);
    pillX.set(index * SLOT_W);
    lastIndexRef.current = index;
    if (pathname !== target.path) {
      window.setTimeout(() => router.push(target.path), 200);
    }
  }, [pathname, pillX, router]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startXRef.current = e.clientX;
    startPillRef.current = lastIndexRef.current * SLOT_W;
    movedRef.current = false;
    setDragging(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 6) movedRef.current = true;
    if (!movedRef.current) return;
    const max = (ITEMS.length - 1) * SLOT_W;
    setDragX(Math.max(0, Math.min(max, startPillRef.current + dx)));
  }, [dragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startXRef.current;
    setDragging(false);
    setDragX(null);
    if (!movedRef.current && Math.abs(dx) < 6) {
      // Tap: find item under finger
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const rel = e.clientX - rect.left - PADDING;
        const idx = Math.round(rel / SLOT_W);
        if (idx >= 0 && idx < ITEMS.length) {
          navigate(idx);
          return;
        }
      }
    }
    const idx = Math.round(
      Math.max(0, Math.min((ITEMS.length - 1) * SLOT_W, startPillRef.current + dx)) / SLOT_W
    );
    navigate(idx);
  }, [dragging, navigate]);

  const x = dragging && dragX !== null ? dragX : pillX;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 70,
        touchAction: 'none',
      }}
    >
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: `${PADDING}px`,
          borderRadius: '999px',
          background: 'rgba(16, 16, 28, 0.62)',
          backdropFilter: 'blur(26px) saturate(180%)',
          WebkitBackdropFilter: 'blur(26px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 44px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
          cursor: 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        {/* Sliding pill */}
        <motion.div
          style={{
            position: 'absolute',
            left: PADDING,
            top: PADDING,
            width: PILL_W,
            height: `calc(100% - ${PADDING * 2}px)`,
            borderRadius: '999px',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.95), rgba(217,70,239,0.9))',
            boxShadow: '0 4px 22px rgba(139,92,246,0.55), inset 0 1px 0 rgba(255,255,255,0.35)',
            border: '1px solid rgba(255,255,255,0.22)',
            x,
            scale: pulse ? 1.06 : 1,
          }}
        />

        {ITEMS.map((item, i) => {
          const active = i === activeIndex && !dragging;
          return (
            <div
              key={item.key}
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
                pointerEvents: 'none',
              }}
            >
              <div style={{
                color: active ? 'white' : 'rgba(255,255,255,0.45)',
                transition: 'color 0.2s',
                transform: active ? 'scale(1.05)' : undefined,
              }}>
                {item.icon}
              </div>
              <span style={{
                fontSize: '0.52rem',
                fontWeight: active ? 700 : 500,
                color: active ? 'white' : 'rgba(255,255,255,0.35)',
                letterSpacing: '0.2px',
                transition: 'color 0.2s',
                whiteSpace: 'nowrap',
              }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}