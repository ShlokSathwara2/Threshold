"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type RefreshFn = () => void | Promise<void>;
type Phase = 'idle' | 'pulling' | 'refreshing' | 'done';

const PullRefreshContext = createContext<(fn: RefreshFn | null) => void>(() => {});

export function usePullToRefresh(fn: RefreshFn) {
  const setHandler = useContext(PullRefreshContext);
  useEffect(() => {
    setHandler(fn);
    return () => setHandler(null);
  }, [fn, setHandler]);
}

interface PullRefreshProps {
  mainRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

export default function PullRefresh({ mainRef, children }: PullRefreshProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [flash, setFlash] = useState(false);
  const handlerRef = useRef<RefreshFn | null>(null);
  const startY = useRef(0);
  const pointerDown = useRef(false);
  const timersRef = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const setHandler = useCallback((fn: RefreshFn | null) => {
    handlerRef.current = fn;
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    const atTop = () => el.scrollTop <= 2;

    const onTouchStart = (e: TouchEvent) => {
      pointerDown.current = true;
      if (atTop() && handlerRef.current) {
        startY.current = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pointerDown.current || !handlerRef.current) return;
      if (!atTop()) {
        setPhase('idle');
        setProgress(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 10) {
        setPhase('pulling');
        setProgress(Math.min(1, (dy - 10) / 70));
      } else if (dy < 0) {
        setPhase('idle');
        setProgress(0);
      }
    };

    const onTouchEnd = async () => {
      pointerDown.current = false;
      if (!handlerRef.current) {
        setPhase('idle');
        setProgress(0);
        return;
      }
      if (progress >= 1) {
        setPhase('refreshing');
        try {
          await handlerRef.current();
        } catch {
          /* ignore */
        }
        setPhase('done');
        setFlash(true);
        later(() => setFlash(false), 700);
        later(() => setPhase('idle'), 950);
      } else {
        setPhase('idle');
        setProgress(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [mainRef, progress, later]);

  const showIndicator = phase !== 'idle';
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <PullRefreshContext.Provider value={setHandler}>
      {children}

      {/* Completion confirmation: expanding ripple + full-screen accent flash */}
      <AnimatePresence>
        {flash && (
          <>
            <motion.div
              key="flash"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 78,
                pointerEvents: 'none',
                background:
                  'radial-gradient(ellipse 90% 55% at 50% 0%, rgba(var(--threshold-accent-rgb), 0.18), rgba(var(--threshold-accent-rgb), 0.05) 45%, transparent 72%)',
              }}
            />
            <motion.div
              key="ripple"
              initial={{ opacity: 0.5, scale: 0.3 }}
              animate={{ opacity: 0, scale: 3.4 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                position: 'fixed',
                top: 'calc(60px + env(safe-area-inset-top, 0px))',
                left: '50%',
                marginLeft: -18,
                width: 36,
                height: 36,
                borderRadius: '50%',
                border: '2px solid var(--threshold-accent)',
                zIndex: 79,
                pointerEvents: 'none',
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* Pull / refresh indicator */}
      <AnimatePresence>
        {showIndicator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 22 }}
            style={{
              position: 'fixed',
              top: 'calc(60px + env(safe-area-inset-top, 0px))',
              left: '50%',
              x: '-50%',
              zIndex: 80,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '5px',
              pointerEvents: 'none',
            }}
          >
            {/* Glowing blob that pulses while refreshing */}
            <AnimatePresence>
              {phase === 'refreshing' && (
                <motion.div
                  key="glow"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{
                    opacity: 1,
                    scale: [1, 1.4, 1],
                    transition: { scale: { repeat: Infinity, duration: 1.1, ease: 'easeInOut' } },
                  }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    marginLeft: -22,
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: 'rgba(var(--threshold-accent-rgb), 0.28)',
                    filter: 'blur(10px)',
                  }}
                />
              )}
            </AnimatePresence>

            <motion.div
              animate={{ scale: 0.9 + progress * 0.12 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              style={{ position: 'relative', width: 36, height: 36 }}
            >
              {/* Rotating ring while refreshing */}
              <motion.div
                animate={{ rotate: phase === 'refreshing' ? 360 : 0 }}
                transition={
                  phase === 'refreshing'
                    ? { repeat: Infinity, ease: 'linear', duration: 0.8 }
                    : { duration: 0.2 }
                }
                style={{ position: 'absolute', inset: 0 }}
              >
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="none"
                    stroke="rgba(139, 92, 246, 0.15)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r={radius}
                    fill="none"
                    stroke="url(#ptr-grad)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    transform="rotate(-90 18 18)"
                    style={{ transition: 'stroke-dashoffset 0.1s' }}
                  />
                  <defs>
                    <linearGradient id="ptr-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="var(--threshold-accent)" />
                      <stop offset="100%" stopColor="var(--threshold-accent-text)" />
                    </linearGradient>
                  </defs>
                </svg>
              </motion.div>

              {/* Animated checkmark draw on completion */}
              {phase === 'done' && (
                <motion.div
                  initial={{ scale: 0.4 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 15 }}
                  style={{ position: 'absolute', inset: 0, display: 'flex' }}
                >
                  <svg width="36" height="36" viewBox="0 0 36 36">
                    <motion.path
                      d="M12 18l4 4 8-8"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                      style={{ filter: 'drop-shadow(0 0 5px rgba(34, 197, 94, 0.7))' }}
                    />
                  </svg>
                </motion.div>
              )}
            </motion.div>

            {phase === 'done' && (
              <motion.span
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  color: '#22c55e',
                  textShadow: '0 0 10px rgba(34, 197, 94, 0.5)',
                }}
              >
                REFRESHED
              </motion.span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </PullRefreshContext.Provider>
  );
}