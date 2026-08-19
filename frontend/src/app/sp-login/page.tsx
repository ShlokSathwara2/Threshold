"use client";

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { spLoginInit, spLoginVerify, saveSession } from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

const MoltenMetal = dynamic(() => import('@/components/effects/MoltenMetal'), { ssr: false });
const PortalRift = dynamic(() => import('@/components/animations/PortalRift'), { ssr: false });
const CircuitOverload = dynamic(() => import('@/components/animations/CircuitOverload'), { ssr: false });
const LiquidMetalMerge = dynamic(() => import('@/components/animations/LiquidMetalMerge'), { ssr: false });

const animations = ['portal', 'circuit', 'liquid'] as const;
type AnimType = typeof animations[number];

export default function SpLoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [expired] = useState(() => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('expired') === '1');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'credentials' | 'captcha'>('credentials');
  const [activeAnimation, setActiveAnimation] = useState<AnimType | null>(null);
  const captchaRef = useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: `1px solid ${WB(0.1)}`,
    background: WB(0.05),
    color: theme.text,
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.3s',
    boxSizing: 'border-box',
    WebkitAppearance: 'none' as const,
  };

  const handleCredentialsSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both NetID and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const data = await spLoginInit(username.trim());
      if (data.success && data.session_id && data.captcha_image_base64) {
        setSessionId(data.session_id);
        setCaptchaImage(`data:image/png;base64,${data.captcha_image_base64}`);
        setStep('captcha');
        setTimeout(() => captchaRef.current?.focus(), 100);
      } else {
        setError(data.message || 'Failed to load CAPTCHA');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [username, password]);

  const refreshCaptcha = useCallback(async () => {
    try {
      const data = await spLoginInit(username.trim());
      if (data.success && data.session_id && data.captcha_image_base64) {
        setSessionId(data.session_id);
        setCaptchaImage(`data:image/png;base64,${data.captcha_image_base64}`);
        setCaptcha('');
      }
    } catch { /* ignore */ }
  }, [username]);

  const handleCaptchaSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha.trim()) {
      setError('Please enter the CAPTCHA text');
      return;
    }
    setError('');
    setLoading(true);
    const randomAnim = animations[Math.floor(Math.random() * animations.length)];
    setActiveAnimation(randomAnim);
  }, [captcha]);

  const onAnimationComplete = useCallback(async () => {
    setActiveAnimation(null);
    try {
      const data = await spLoginVerify(sessionId, username.trim(), password, captcha.trim());
      if (data.success && data.cookies) {
        await saveSession(data.cookies, username.trim());
        router.push('/dashboard');
      } else {
        setError(data.message || 'Login failed — check your credentials and CAPTCHA');
        setLoading(false);
        setStep('captcha');
        setCaptcha('');
        refreshCaptcha();
      }
    } catch {
      setError('Failed to connect to server');
      setLoading(false);
      setStep('captcha');
    }
  }, [sessionId, username, password, captcha, router, refreshCaptcha]);

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: '#09090f', overflow: 'hidden' }}>
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

      <PortalRift active={activeAnimation === 'portal'} onComplete={onAnimationComplete} />
      <CircuitOverload active={activeAnimation === 'circuit'} onComplete={onAnimationComplete} />
      <LiquidMetalMerge active={activeAnimation === 'liquid'} onComplete={onAnimationComplete} />

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
            color: theme.text,
            textAlign: 'center',
            marginBottom: '6px',
          }}>
            Student Portal
          </h1>
          <p style={{
            color: W(0.45),
            textAlign: 'center',
            marginBottom: '28px',
            fontSize: '0.85rem',
          }}>
            {step === 'credentials' ? 'Log in with your SRM credentials' : 'Solve the CAPTCHA below'}
          </p>

          {expired && step === 'credentials' && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                padding: '11px 13px',
                borderRadius: '12px',
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.35)',
                marginBottom: '16px',
              }}
            >
              <p style={{
                margin: 0,
                color: '#fbbf24',
                fontSize: '0.78rem',
                fontWeight: 600,
                lineHeight: 1.5,
              }}>
                Your session expired while you were away. Log in again to continue.
              </p>
            </motion.div>
          )}

          {/* Step 1: NetID + Password */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentialsSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', color: W(0.55), fontSize: '0.8rem', marginBottom: '6px' }}>
                  NetID
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. ra2311003010"
                  autoCapitalize="none"
                  autoComplete="username"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = WB(0.1)}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: W(0.55), fontSize: '0.8rem', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your SRM password"
                  autoComplete="current-password"
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = WB(0.1)}
                />
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
                disabled={loading}
                whileTap={{ scale: 0.95 }}
                className={`arrow-btn arrow-btn--primary${loading ? ' arrow-btn--disabled' : ''}`}
                style={{ cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                <div className="arrow-btn__slider" />
                <svg className="arrow-btn__svg--arr1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <svg className="arrow-btn__svg--arr2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <span className="arrow-btn__text">{loading ? 'Loading...' : 'Next'}</span>
              </motion.button>
            </form>
          )}

          {/* Step 2: CAPTCHA */}
          {step === 'captcha' && (
            <form onSubmit={handleCaptchaSubmit}>
              {captchaImage && (
                <div style={{
                  marginBottom: '16px',
                  textAlign: 'center',
                  padding: '16px',
                  borderRadius: '12px',
                  background: WB(0.08),
                  border: `1px solid ${WB(0.1)}`,
                }}>
                  <img
                    src={captchaImage}
                    alt="CAPTCHA"
                    style={{
                      maxWidth: '100%',
                      height: 'auto',
                      maxHeight: '80px',
                      borderRadius: '8px',
                      imageRendering: 'pixelated',
                    }}
                  />
                  <button
                    type="button"
                    onClick={refreshCaptcha}
                    style={{
                      display: 'block',
                      margin: '10px auto 0',
                      background: 'none',
                      border: 'none',
                      color: '#8b5cf6',
                      fontSize: '0.72rem',
                      cursor: 'pointer',
                    }}
                  >
                    Can&apos;t read it? Get a new one
                  </button>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: W(0.55), fontSize: '0.8rem', marginBottom: '6px' }}>
                  Type the text you see above
                </label>
                <input
                  ref={captchaRef}
                  type="text"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                  placeholder="e.g. Ab3X"
                  autoCapitalize="none"
                  autoComplete="off"
                  style={{
                    ...inputStyle,
                    fontFamily: 'monospace',
                    letterSpacing: '2px',
                    textAlign: 'center',
                    fontSize: '16px',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = WB(0.1)}
                />
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

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setStep('credentials');
                    setCaptcha('');
                    setCaptchaImage('');
                    setError('');
                  }}
                  style={{
                    flex: '0 0 auto',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    border: `1px solid ${WB(0.1)}`,
                    background: WB(0.05),
                    color: W(0.5),
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Back
                </button>
                <motion.button
                  type="submit"
                  disabled={loading || activeAnimation !== null}
                  whileTap={{ scale: 0.95 }}
                  className={`arrow-btn arrow-btn--primary${loading ? ' arrow-btn--disabled' : ''}`}
                  style={{ flex: 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                >
                  <div className="arrow-btn__slider" />
                  <svg className="arrow-btn__svg--arr1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <svg className="arrow-btn__svg--arr2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span className="arrow-btn__text">{loading ? 'Logging in...' : 'Log In'}</span>
                </motion.button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
