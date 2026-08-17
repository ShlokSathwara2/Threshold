"use client";

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { isNativePlatform } from '@/lib/capacitor';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { ToolBarType } from '@capgo/capacitor-inappbrowser';

const MoltenMetal = dynamic(() => import('@/components/effects/MoltenMetal'), { ssr: false });
const PortalRift = dynamic(() => import('@/components/animations/PortalRift'), { ssr: false });
const CircuitOverload = dynamic(() => import('@/components/animations/CircuitOverload'), { ssr: false });
const LiquidMetalMerge = dynamic(() => import('@/components/animations/LiquidMetalMerge'), { ssr: false });

const animations = ['portal', 'circuit', 'liquid'] as const;
type AnimType = typeof animations[number];

const SP_LOGIN_URL = 'https://sp.srmist.edu.in/srmiststudentportal/students/loginManager/youLogin.jsp';
const SP_DASHBOARD_URL = 'https://sp.srmist.edu.in/srmiststudentportal/students/template/HRDSystem.jsp';

export default function LoginPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [cookie, setCookie] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeAnimation, setActiveAnimation] = useState<AnimType | null>(null);
  const [nativeLoginLoading, setNativeLoginLoading] = useState(false);
  const [nativeLoginError, setNativeLoginError] = useState('');
  const [nativeAnimating, setNativeAnimating] = useState(false);
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);

  const storeSession = useCallback((cookieStr: string) => {
    localStorage.setItem('threshold_session', JSON.stringify({
      cookies: cookieStr,
      user: 'student',
      timestamp: Date.now(),
    }));
  }, []);

  const storeAndNavigate = useCallback((cookieStr: string) => {
    storeSession(cookieStr);
    router.push('/dashboard');
  }, [storeSession, router]);

  const handleNativeLogin = useCallback(async () => {
    setNativeLoginLoading(true);
    setNativeLoginError('');
    try {
      const { InAppBrowser } = await import('@capgo/capacitor-inappbrowser');
      const { CapacitorCookies } = await import('@capacitor/core');
      await CapacitorCookies.clearAllCookies();

      const { id } = await InAppBrowser.openWebView({
        url: SP_LOGIN_URL,
        toolbarType: ToolBarType.NAVIGATION,
        title: 'SRM Student Portal',
        customUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        captureConsoleLogs: true,
      });

      let cleanedUp = false;
      const cleanup = async () => {
        if (cleanedUp) return;
        cleanedUp = true;
        try {
          await InAppBrowser.removeAllListeners();
          await InAppBrowser.close({ id });
        } catch {}
      };

      await InAppBrowser.addListener('urlChangeEvent', async (event: { url: string }) => {
        if (cleanedUp) return;
        if (event.url.includes('HRDSystem') || event.url.includes('template')) {
          try {
            const cookies = await InAppBrowser.getCookies({ url: event.url, includeHttpOnly: true });
            await cleanup();

            const cookieStr = Object.entries(cookies)
              .map(([key, value]) => `${key}=${value}`)
              .join('; ');

            if (cookieStr) {
              storeAndNavigate(cookieStr);
            } else {
              setNativeLoginError('No cookies received after login. Please try again.');
              setNativeLoginLoading(false);
            }
          } catch {
            await cleanup();
            setNativeLoginError('Failed to read cookies. Please try again.');
            setNativeLoginLoading(false);
          }
        }
      });

      await InAppBrowser.addListener('consoleMessage', (event: { level: string; message: string }) => {
        console.log(`[IAB-Console] ${event.level}: ${event.message}`);
      });

      await InAppBrowser.addListener('closeEvent', async () => {
        if (!cleanedUp) {
          await cleanup();
          setNativeLoginLoading(false);
        }
      });
    } catch (err) {
      console.error('Native login error:', err);
      setNativeLoginError('Failed to open Student Portal. Please try again.');
      setNativeLoginLoading(false);
    }
  }, [storeAndNavigate]);

  const handleNativeLoginTap = useCallback(() => {
    if (nativeAnimating || nativeLoginLoading) return;
    setNativeAnimating(true);
    window.setTimeout(() => {
      setNativeAnimating(false);
      handleNativeLogin();
    }, 650);
  }, [nativeAnimating, nativeLoginLoading, handleNativeLogin]);

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/sp/set-cookies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookie.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        storeAndNavigate(cookie.trim());
      } else {
        setError(data.message || 'Failed to set cookies');
      }
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [cookie, storeAndNavigate]);

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
            color: theme.text,
            textAlign: 'center',
            marginBottom: '6px',
          }}>
            {isNative ? 'Student Portal' : 'Welcome back'}
          </h1>
          <p style={{
            color: W(0.45),
            textAlign: 'center',
            marginBottom: '28px',
            fontSize: '0.85rem',
          }}>
            {isNative
              ? 'Log in with your SRM credentials'
              : 'Paste your Student Portal session cookie'}
          </p>

          {isNative ? (
            /* ── Native WebView Login ── */
            <div>
              <AnimatePresence>
                {nativeLoginError && (
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
                    {nativeLoginError}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="button"
                disabled={nativeLoginLoading || activeAnimation !== null || nativeAnimating}
                whileTap={{ scale: 0.95 }}
                className={`arrow-btn arrow-btn--primary${nativeLoginLoading ? ' arrow-btn--disabled' : ''}${nativeAnimating ? ' arrow-btn--animating' : ''}`}
                style={{
                  cursor: nativeLoginLoading || nativeAnimating ? 'not-allowed' : 'pointer',
                  width: '100%',
                }}
                onClick={handleNativeLoginTap}
              >
                <div className="arrow-btn__slider" />
                <svg className="arrow-btn__svg--arr1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <svg className="arrow-btn__svg--arr2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <span className="arrow-btn__text">
                  {nativeLoginLoading ? 'Opening Student Portal...' : 'Log in with Student Portal'}
                </span>
              </motion.button>

              <p style={{
                color: W(0.3),
                fontSize: '0.7rem',
                marginTop: '12px',
                lineHeight: 1.4,
                textAlign: 'center',
              }}>
                You&apos;ll be taken to the real SRM login page. No credentials stored.
              </p>
            </div>
          ) : (
            /* ── Web: Manual Cookie Paste ── */
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: W(0.55), fontSize: '0.8rem', marginBottom: '6px' }}>
                  Session Cookie
                </label>
                <textarea
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  placeholder="JSESSIONID=...; other cookies..."
                  rows={3}
                  spellCheck={false}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    lineHeight: 1.4,
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = WB(0.1)}
                />
                <p style={{
                  color: W(0.3),
                  fontSize: '0.7rem',
                  marginTop: '6px',
                  lineHeight: 1.4,
                }}>
                  Log into sp.srmist.edu.in, open DevTools (F12) → Network → any request → copy the Cookie header value.
                </p>
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
          )}
        </motion.div>
      </div>
    </div>
  );
}
