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

type RefreshFn = () => void | Promise<void>;

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
  const [pulling, setPulling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showCheck, setShowCheck] = useState(false);
  const handlerRef = useRef<RefreshFn | null>(null);
  const startY = useRef(0);
  const pointerDown = useRef(false);

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
        setPulling(false);
        setProgress(0);
        return;
      }
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 10) {
        setPulling(true);
        setProgress(Math.min(1, (dy - 10) / 70));
      } else if (dy < 0) {
        setPulling(false);
        setProgress(0);
      }
    };

    const onTouchEnd = async () => {
      pointerDown.current = false;
      if (!handlerRef.current) {
        setPulling(false);
        setProgress(0);
        return;
      }
      if (progress >= 1) {
        setShowCheck(true);
        try {
          await handlerRef.current();
        } catch {
          /* ignore */
        }
        setShowCheck(false);
      }
      setPulling(false);
      setProgress(0);
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [mainRef, progress]);

  const showIndicator = pulling || showCheck;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <PullRefreshContext.Provider value={setHandler}>
      {children}
      {showIndicator && (
        <div
          style={{
            position: 'fixed',
            top: 'calc(60px + env(safe-area-inset-top, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '36px',
            height: '36px',
          }}
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
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            {showCheck && (
              <path
                d="M12 18l4 4 8-8"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: 'drop-shadow(0 0 4px rgba(34, 197, 94, 0.6))',
                }}
              />
            )}
          </svg>
        </div>
      )}
    </PullRefreshContext.Provider>
  );
}