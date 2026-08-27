"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { isNativePlatform } from '@/lib/capacitor';

const ThresholdText = dynamic(() => import('@/components/effects/ThresholdText'), { ssr: false });
const RippleDistortion = dynamic(() => import('@/components/effects/RippleDistortion'), { ssr: false });

const tagline = "Attendance, exams, insights — your semester copilot.";
const taglineWords = tagline.split(' ');

const features = [
  { title: 'Attendance', description: 'Per-subject tracking with recovery plans & 75% guards', color: '#22c55e', icon: 'attendance' },
  { title: 'Bunk Planner', description: 'Know which classes you can safely skip today — and what each skip costs', color: '#8b5cf6', icon: 'bunk' },
  { title: 'Exam Tracker', description: 'Cloud-synced countdowns, date alerts & hall-ticket access', color: '#3b82f6', icon: 'exam' },
  { title: 'Smart Notifications', description: 'Morning briefs & exam reminders fired at the right time', color: '#f59e0b', icon: 'bell' },
  { title: 'App Lock', description: 'Fingerprint, face or PIN gate — cached data stays private', color: '#06b6d4', icon: 'lock' },
  { title: 'Universal Search', description: 'One bar — subjects, marks & timetable slots in a tap', color: '#ef4444', icon: 'search' },
];

const FeatureIcon = ({ type, color }: { type: string; color: string }) => {
  const icons: Record<string, React.ReactNode> = {
    attendance: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <polyline points="9 16 10.5 17.5 15 13" />
      </svg>
    ),
    bunk: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    exam: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    insights: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    ),
    search: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    bell: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    lock: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
  };
  return <>{icons[type]}</>;
};

export default function WelcomePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [starting, setStarting] = useState(false);
  const [isNative, setIsNative] = useState(false);
  const [deferredInstall, setDeferredInstall] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredInstall(e);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const handler = () => { setCanInstall(false); setDeferredInstall(null); };
    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    const { outcome } = await deferredInstall.userChoice;
    setDeferredInstall(null);
    setCanInstall(false);
  };

  const handleGetStarted = () => {
    if (starting) return;
    setStarting(true);
    window.setTimeout(() => router.push('/login'), 750);
  };

  // Swipe-to-start: the handle must be dragged all the way across the track.
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const TRACK_W = 288;
  const HANDLE = 40;
  const PAD = 8;
  const maxX = TRACK_W - HANDLE - PAD * 2;

  useEffect(() => {
    setDragX(PAD);
  }, []);

  const onHandleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (starting) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onHandleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || starting) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - HANDLE / 2;
    setDragX(Math.max(PAD, Math.min(PAD + maxX, x)));
  };

  const onHandleUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX >= PAD + maxX - 4) {
      handleGetStarted();
    } else {
      setDragX(PAD);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', background: '#09090f' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#09090f' }}>
        <RippleDistortion
          src="https://images.unsplash.com/photo-1507400492013-162706c8c05e?q=80&w=3432&auto=format&fit=crop"
          brushSize={100}
          strength={0.15}
          swirl={0.8}
          rings={3}
          grayscale
          trigger="hover"
          quality="low"
        />
      </div>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Hero */}
        <section style={{
          minHeight: '55dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}>
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            style={{
              width: 'clamp(120px, 30vw, 180px)',
              height: 'clamp(120px, 30vw, 180px)',
              borderRadius: '28px',
              overflow: 'hidden',
              boxShadow: `0 20px 60px ${theme.glow}, 0 0 40px ${theme.accent}33`,
              border: `2px solid ${theme.accent}44`,
              marginBottom: '20px',
              position: 'relative',
              zIndex: 5,
            }}
          >
            <img
              src="/logo.png"
              alt="Threshold"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </motion.div>

          {/* ThresholdText — animated text below logo */}
          <div
            style={{ width: '100%', maxWidth: '500px', height: '80px', position: 'relative', zIndex: 5 }}
          >
            <ThresholdText
              text="THRESHOLD"
              particleSize={2}
              density={4}
              color="#ffffff"
              highlightColor="#8b5cf6"
              scatter={80}
              gatherDuration={1800}
              stagger={400}
              trigger="mount"
              fontSize="clamp(2rem, 8vw, 3rem)"
              fontWeight={800}
              glow
            />
          </div>

          {/* Motion animations — only below THRESHOLD */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.2, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            style={{
              fontSize: '1.05rem',
              textAlign: 'center',
              maxWidth: '340px',
              marginTop: '24px',
              lineHeight: 1.7,
              letterSpacing: '0.3px',
              fontFamily: "'Inter', sans-serif",
              fontWeight: 400,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: '6px 0',
            }}
          >
            {taglineWords.map((word, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: 2.4 + i * 0.06,
                  duration: 0.5,
                  ease: [0.23, 1, 0.32, 1],
                }}
                style={{
                  color: W(0.75),
                  marginRight: '6px',
                }}
              >
                {word}
              </motion.span>
            ))}
          </motion.p>

          {/* Get Started — swipe the handle all the way across to launch */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.0, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            style={{ marginTop: '36px' }}
          >
            <div
              ref={trackRef}
              className={`get-started-btn${starting ? ' get-started-btn--animating' : ''}`}
              style={{
                width: TRACK_W,
                height: 56,
                padding: 0,
                cursor: 'default',
                touchAction: 'none',
                userSelect: 'none',
              }}
            >
              <span
                className="get-started-btn__text"
                style={{
                  position: 'absolute',
                  width: '100%',
                  textAlign: 'center',
                  marginLeft: 0,
                  color: 'rgba(255,255,255,0.92)',
                  pointerEvents: 'none',
                }}
              >
                Swipe to get started
              </span>              <div
                className="get-started-btn__slider"
                onPointerDown={onHandleDown}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
                style={{
                  width: HANDLE,
                  height: HANDLE,
                  left: starting ? undefined : dragX,
                  cursor: dragging ? 'grabbing' : 'grab',
                  transition: dragging ? 'none' : undefined,
                  touchAction: 'none',
                  background: 'rgba(255,255,255,0.22)',
                  border: '1px solid rgba(255,255,255,0.45)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="19" height="19">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Install / Download — web only */}
        {!isNative && (
          <section style={{ padding: '0 16px 32px', width: '100%' }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 3.4, duration: 0.6 }}
              style={{
                maxWidth: '400px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <p style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                letterSpacing: '1px',
                textTransform: 'uppercase',
                color: W(0.4),
                textAlign: 'center',
                marginBottom: '4px',
              }}>
                Get Threshold
              </p>
              {canInstall && (
                <button
                  onClick={handleInstall}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(139,92,246,0.35)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    width: '100%',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    background: 'rgba(139,92,246,0.2)',
                    flexShrink: 0,
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12l7 7 7-7" />
                      <rect x="3" y="19" width="18" height="2" rx="1" fill="#a78bfa" opacity="0.4" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c4b5fd', margin: 0 }}>
                      Install App
                    </p>
                    <p style={{ fontSize: '0.7rem', color: W(0.4), margin: '3px 0 0', lineHeight: 1.4 }}>
                      Add Threshold to your home screen
                    </p>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#a78bfa' }}>↗</span>
                </button>
              )}
              {!canInstall && (
                <a
                  href="https://threshold-pi-seven.vercel.app"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.18), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(139,92,246,0.35)',
                    textDecoration: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{
                    width: '44px',
                    height: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    background: 'rgba(139,92,246,0.2)',
                    flexShrink: 0,
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#c4b5fd', margin: 0 }}>
                      Download Website
                    </p>
                    <p style={{ fontSize: '0.7rem', color: W(0.4), margin: '3px 0 0', lineHeight: 1.4 }}>
                      Access Threshold on any device
                    </p>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: '0.85rem', color: '#a78bfa' }}>↗</span>
                </a>
              )}
            </motion.div>
          </section>
        )}

        {/* Features — mobile: single column, compact cards */}
        <section style={{ padding: '32px 16px 48px', width: '100%' }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              fontSize: '1.15rem',
              color: W(0.7),
              textAlign: 'center',
              marginBottom: '28px',
              fontWeight: 500,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            Everything you need
          </motion.h2>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            maxWidth: '400px',
            margin: '0 auto',
          }}>
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                whileHover={{ scale: 1.02, backgroundColor: WB(0.06) }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '16px',
                  background: WB(0.03),
                  border: `1px solid ${WB(0.06)}`,
                  backdropFilter: 'blur(12px)',
                  cursor: 'pointer',
                  transition: 'border-color 0.3s, box-shadow 0.3s',
                }}
              >
                <div style={{
                  width: '42px',
                  height: '42px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  background: `${feature.color}12`,
                  flexShrink: 0,
                }}>
                  <FeatureIcon type={feature.icon} color={feature.color} />
                </div>
                <div>
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: W(0.9), marginBottom: '2px' }}>
                    {feature.title}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: W(0.4), lineHeight: 1.4 }}>
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Footer */}
      </div>
    </div>
  );
}
