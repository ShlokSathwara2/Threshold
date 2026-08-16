"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

type RefreshFn = () => Promise<void> | void;

const PullRefreshContext = createContext<(fn: RefreshFn | null) => void>(() => {});

export function usePullToRefresh(fn: RefreshFn) {
  const setHandler = useContext(PullRefreshContext);
  const fnRef = useRef<RefreshFn>(fn);
  fnRef.current = fn;
  useEffect(() => {
    setHandler(fnRef.current);
    return () => setHandler(null);
  }, [setHandler]);
}

const CIRC = 125.6; // 2 * PI * 20
const TRIGGER = 70;
const MAX_PULL = 120;

export default function PullRefresh({
  mainRef,
  children,
}: {
  mainRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const handlerRef = useRef<RefreshFn | null>(null);
  const setHandler = useCallback((fn: RefreshFn | null) => {
    handlerRef.current = fn;
  }, []);

  const wrapRef = useRef<HTMLDivElement>(null);
  const spinRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const checkRef = useRef<HTMLSpanElement>(null);
  const stateRef = useRef<'idle' | 'pulling' | 'refreshing'>('idle');
  const pullRef = useRef(0);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);
  const mountedRef = useRef(true);

  const resetIndicator = useCallback(() => {
    const wrap = wrapRef.current;
    const spin = spinRef.current;
    const arc = arcRef.current;
    const check = checkRef.current;
    if (!wrap || !spin || !arc || !check) return;
    wrap.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
    wrap.style.transform = 'translateY(-74px)';
    wrap.style.opacity = '0';
    spin.style.animation = 'none';
    spin.style.transform = 'rotate(0deg)';
    arc.style.transition = 'stroke-dashoffset 0.25s ease';
    arc.style.strokeDashoffset = String(CIRC);
    check.style.opacity = '0';
    check.style.transform = 'scale(0.4)';
    window.setTimeout(() => {
      if (!mountedRef.current) return;
      wrap.style.transition = '';
    }, 600);
  }, []);

  const runRefresh = useCallback(async () => {
    const fn = handlerRef.current;
    if (!fn) return;
    try {
      await fn();
    } catch {
      // refresh callbacks must not break the indicator
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const main = mainRef.current;
    if (!main) return;

    const showArc = (progress: number) => {
      const arc = arcRef.current;
      if (!arc) return;
      arc.style.transition = 'stroke-dashoffset 0.12s linear';
      arc.style.strokeDashoffset = String(CIRC * (1 - Math.min(progress, 1)));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (stateRef.current === 'refreshing') return;
      if (main.scrollTop <= 1) {
        startYRef.current = e.touches[0].clientY;
        pullingRef.current = true;
      } else {
        pullingRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (stateRef.current === 'refreshing' || !pullingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0 || main.scrollTop > 1) {
        pullingRef.current = false;
        return;
      }
      e.preventDefault();
      const pull = Math.min(dy * 0.5, MAX_PULL);
      pullRef.current = pull;
      stateRef.current = 'pulling';

      const wrap = wrapRef.current;
      const spin = spinRef.current;
      if (wrap) {
        wrap.style.transition = '';
        wrap.style.transform = `translateY(${-74 + pull}px)`;
        wrap.style.opacity = String(Math.min(1, pull / 26));
      }
      if (spin) spin.style.transform = `rotate(${pull * 2.2}deg)`;
      showArc(pull / TRIGGER);
    };

    const finish = async () => {
      const wrap = wrapRef.current;
      const spin = spinRef.current;
      const arc = arcRef.current;
      const check = checkRef.current;
      if (!wrap || !spin || !arc || !check) return;

      stateRef.current = 'refreshing';
      pullingRef.current = false;
      pullRef.current = 0;

      spin.style.animation = 'ptr-spin 0.9s linear infinite';
      spin.style.transform = 'rotate(0deg)';
      wrap.style.transition = 'transform 0.35s cubic-bezier(0.23, 1, 0.32, 1)';
      wrap.style.transform = 'translateY(0px)';
      arc.style.transition = 'stroke-dashoffset 0.3s ease';
      arc.style.strokeDashoffset = '0';

      await runRefresh();

      if (!mountedRef.current) return;
      // Success pop
      arc.style.strokeDashoffset = '0';
      check.style.opacity = '1';
      check.style.transform = 'scale(1)';
      await new Promise((r) => window.setTimeout(r, 550));

      if (!mountedRef.current) return;
      resetIndicator();
      stateRef.current = 'idle';
    };

    const onTouchEnd = () => {
      if (stateRef.current !== 'pulling') return;
      pullingRef.current = false;
      if (pullRef.current >= TRIGGER) {
        finish();
      } else {
        stateRef.current = 'idle';
        resetIndicator();
      }
    };

    const onTouchCancel = () => {
      if (stateRef.current !== 'pulling') return;
      stateRef.current = 'idle';
      resetIndicator();
    };

    main.addEventListener('touchstart', onTouchStart, { passive: true });
    main.addEventListener('touchmove', onTouchMove, { passive: false });
    main.addEventListener('touchend', onTouchEnd, { passive: true });
    main.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
      mountedRef.current = false;
      main.removeEventListener('touchstart', onTouchStart);
      main.removeEventListener('touchmove', onTouchMove);
      main.removeEventListener('touchend', onTouchEnd);
      main.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [mainRef, runRefresh, resetIndicator]);

  return (
    <PullRefreshContext.Provider value={setHandler}>
      {/* Pull indicator */}
      <div
        ref={wrapRef}
        style={{
          position: 'fixed',
          top: 'calc(52px + env(safe-area-inset-top, 0px))',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 80,
          transform: 'translateY(-74px)',
          opacity: 0,
        }}
      >
        <div
          ref={spinRef}
          style={{
            position: 'relative',
            width: 48,
            height: 48,
            willChange: 'transform',
            filter: 'drop-shadow(0 0 12px rgba(139, 92, 246, 0.6))',
          }}
        >
          <svg viewBox="0 0 48 48" style={{ width: 48, height: 48 }}>
            <defs>
              <linearGradient id="ptrGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#d946ef" />
              </linearGradient>
            </defs>
            <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(139, 92, 246, 0.12)" strokeWidth="4.5" />
            <circle
              ref={arcRef}
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="url(#ptrGrad)"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeDasharray={String(CIRC)}
              strokeDashoffset={String(CIRC)}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          </svg>
          <span
            ref={checkRef}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399',
              fontSize: '1.1rem',
              fontWeight: 800,
              opacity: 0,
              transform: 'scale(0.4)',
              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            ✓
          </span>
        </div>
      </div>
      {children}
    </PullRefreshContext.Provider>
  );
}