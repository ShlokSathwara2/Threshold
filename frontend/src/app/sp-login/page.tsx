"use client";

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { setSpCookies } from '@/lib/api';

const MoltenMetal = dynamic(() => import('@/components/effects/MoltenMetal'), { ssr: false });
const PortalRift = dynamic(() => import('@/components/animations/PortalRift'), { ssr: false });
const CircuitOverload = dynamic(() => import('@/components/animations/CircuitOverload'), { ssr: false });
const LiquidMetalMerge = dynamic(() => import('@/components/animations/LiquidMetalMerge'), { ssr: false });

const animations = ['portal', 'circuit', 'liquid'] as const;
type AnimType = typeof animations[number];

export default function SpLoginPage() {
  const router = useRouter();
  const [cookie, setCookie] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<AnimType | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookie.trim()) {
      setError('Please paste your Student Portal session cookie');
      return;
    }
    setError('');
    setLoading(true);
    const randomAnim = animations[Math.floor(Math.random() * animations.length)];
    setActiveAnimation(randomAnim);
  }, [cookie]);

  const onAnimationComplete = useCallback(async () => {
    setActiveAnimation(null);
    try {
      const data = await setSpCookies(cookie.trim());
      if (data.success) {
        localStorage.setItem('threshold_session', JSON.stringify({
          cookies: cookie.trim(),
          user: 'student',
          timestamp: Date.now(),
        }));
        router.push('/dashboard');
      } else {
        setError(data.message || 'Failed to set cookies');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [cookie, router]);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.05)',
    color: 'white',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box',
    WebkitAppearance: 'none' as const,
    fontFamily: 'monospace',
  };

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: '#09090f', overflow: 'hidden' }}>
      {/* MoltenMetal Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <MoltenMetal
          color1="#5227FF"
          color2="#FF9FFC"
          color3="#FFFFFF"
          speed={0.3}
          scale={3.5}
          detail={4}
          glow={1.8}
          coreSize={0.08}
          swirl={1.2}
          fold={-0.25}
          blackPoint={0.04}
          brightness={1.2}
          colorMode="molten"
          grain
          grainIntensity={0.04}
          mouseInteraction
          mouseStrength={0.25}
          opacity={0.85}
        />
      </div>

      {/* Submit Animations */}
      <PortalRift active={activeAnimation === 'portal'} onComplete={onAnimationComplete} />
      <CircuitOverload active={activeAnimation === 'circuit'} onComplete={onAnimationComplete} />
      <LiquidMetalMerge active={activeAnimation === 'liquid'} onComplete={onAnimationComplete} />

      {/* Login Card */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 20px',
        paddingTop: 'calc(60px + env(safe-area-inset-top, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Go Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          onClick={() => router.push('/welcome')}
          className="arrow-btn arrow-btn--back"
          style={{
            position: 'fixed',
            top: 'calc(12px + env(safe-area-inset-top, 0px))',
            left: '16px',
            zIndex: 20,
          }}
        >
          <div className="arrow-btn__slider">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </div>
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
          style={{
            width: '100%',
            maxWidth: '360px',
            padding: '28px 20px',
            borderRadius: '20px',
            background: 'rgba(10, 10, 30, 0.65)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.1)',
          }}
        >
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'white',
            textAlign: 'center',
            marginBottom: '6px',
          }}>
            Student Portal
          </h1>
          <p style={{
            color: 'rgba(255,255,255,0.45)',
            textAlign: 'center',
            marginBottom: '28px',
            fontSize: '0.85rem',
          }}>
            Paste your session cookie to connect
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', marginBottom: '6px' }}>
                Session Cookie
              </label>
              <textarea
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="JSESSIONID=...; TS9...=..."
                rows={3}
                spellCheck={false}
                style={{
                  ...inputStyle,
                  resize: 'vertical',
                  lineHeight: 1.4,
                }}
                onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
              <div style={{
                marginTop: '8px',
                padding: '10px 12px',
                borderRadius: '10px',
                background: 'rgba(139, 92, 246, 0.06)',
                border: '1px solid rgba(139, 92, 246, 0.15)',
              }}>
                <p style={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.72rem',
                  lineHeight: 1.5,
                  margin: 0,
                }}>
                  <strong style={{ color: 'rgba(255,255,255,0.7)' }}>How to get your cookie:</strong>
                  <br />1. Log into <span style={{ color: '#a78bfa' }}>sp.srmist.edu.in</span> in a new tab
                  <br />2. Open DevTools (F12) → <span style={{ color: '#a78bfa' }}>Application</span> → Cookies → sp.srmist.edu.in
                  <br />3. Copy the <span style={{ color: '#a78bfa' }}>JSESSIONID</span> and <span style={{ color: '#a78bfa' }}>TS9...</span> cookie values
                  <br />4. Paste as: <code style={{ color: '#a78bfa', fontSize: '0.68rem' }}>JSESSIONID=...; TS9...=...</code>
                </p>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#fca5a5',
                    fontSize: '0.8rem',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading || activeAnimation !== null}
              whileTap={{ scale: 0.95 }}
              className={`arrow-btn arrow-btn--primary${loading ? ' arrow-btn--disabled' : ''}`}
              style={{
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              <div className="arrow-btn__slider" />
              <svg className="arrow-btn__svg--arr1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <svg className="arrow-btn__svg--arr2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              <span className="arrow-btn__text">{loading ? 'Connecting...' : 'Connect'}</span>
            </motion.button>
          </form>
        </motion.div>

        {/* Footer */}
        <p style={{
          marginTop: 'auto',
          paddingTop: '24px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          color: 'rgba(255,255,255,0.2)',
          fontSize: '0.72rem',
        }}>
          Made by Shlok Sathwara
        </p>
      </div>
    </div>
  );
}
