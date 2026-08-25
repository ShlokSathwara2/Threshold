"use client";

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { isNativePlatform } from '@/lib/capacitor';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { saveSession, campusWebLogin, campusWebAttendance } from '@/lib/api';
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
  const [netId, setNetId] = useState('');
  const [password, setPassword] = useState('');
  const [webLoginLoading, setWebLoginLoading] = useState(false);
  const [webLoginError, setWebLoginError] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaStep, setCaptchaStep] = useState<'credentials' | 'captcha'>('credentials');

  useEffect(() => {
    setIsNative(isNativePlatform());
  }, []);

  const storeSession = useCallback(async (cookieStr: string) => {
    // Keyed by the REAL identity (SP reg number, resolved from the profile),
    // so a friend logging in on this phone never sees your exams/OPT marks.
    await saveSession(cookieStr);
  }, []);

  const storeAndNavigate = useCallback(async (cookieStr: string) => {
    await storeSession(cookieStr);
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
              await storeAndNavigate(cookieStr);
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

  const [captchaLoading, setCaptchaLoading] = useState(false);

  const initCaptchaSession = useCallback(async () => {
    setCaptchaLoading(true);
    setWebLoginError('');
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/sp/login-init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'student' }),
      });
      const data = await res.json();
      if (data.success && data.session_id) {
        setCaptchaSessionId(data.session_id);
        setCaptchaImage(`data:image/png;base64,${data.captcha_image_base64}`);
      } else {
        setWebLoginError(data.message || 'Failed to load CAPTCHA');
      }
    } catch {
      setWebLoginError('Failed to connect to backend server');
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  const initializedRef = useState(() => ({ current: false }))[0];

  useEffect(() => {
    if (!isNativePlatform() && !initializedRef.current) {
      initializedRef.current = true;
      initCaptchaSession();
    }
  }, [initCaptchaSession, initializedRef]);

  const handleWebLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setWebLoginError('');

    if (!netId.trim() || !password.trim()) {
      setWebLoginError('Please enter your Net ID and password');
      return;
    }
    if (!captchaAnswer.trim()) {
      setWebLoginError('Please enter the CAPTCHA text');
      return;
    }
    if (!captchaSessionId) {
      setWebLoginError('Session not ready. Refreshing CAPTCHA...');
      initCaptchaSession();
      return;
    }

    setWebLoginLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${API_BASE}/sp/login-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: captchaSessionId,
          username: netId.trim(),
          password: password.trim(),
          captcha: captchaAnswer.trim(),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setWebLoginError(data.message || 'Login failed. Please try again.');
        setCaptchaAnswer('');
        initCaptchaSession();
        return;
      }

      const cookieStr = data.cookies || '';
      if (cookieStr) {
        await storeAndNavigate(cookieStr);
      } else {
        throw new Error('No session cookies received');
      }
    } catch (err) {
      setWebLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setWebLoginLoading(false);
    }
  }, [netId, password, captchaAnswer, captchaSessionId, storeAndNavigate, initCaptchaSession]);

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
        await storeAndNavigate(cookie.trim());
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
    padding: '12px 14px',
    borderRadius: '12px',
    background: WB(0.05),
    border: `1px solid ${WB(0.1)}`,
    color: theme.text,
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s',
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
            {isNative ? 'Student Portal' : 'Login'}
          </h1>
          <p style={{
            color: W(0.45),
            textAlign: 'center',
            marginBottom: '28px',
            fontSize: '0.85rem',
          }}>
            {isNative
              ? 'Log in with your SRM credentials'
              : 'Enter your credentials to access the portal'}
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
            </div>
          ) : (
            /* ── Web: All-in-One NetID + Password + CAPTCHA Login ── */
            <form onSubmit={handleWebLogin}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', color: W(0.55), fontSize: '0.8rem', marginBottom: '6px' }}>
                  Net ID
                </label>
                <input
                  type="text"
                  value={netId}
                  onChange={(e) => setNetId(e.target.value)}
                  placeholder="e.g. ss1516"
                  spellCheck={false}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = WB(0.1)}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', color: W(0.55), fontSize: '0.8rem', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your SRM password"
                  spellCheck={false}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = WB(0.1)}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label style={{ color: W(0.55), fontSize: '0.8rem' }}>
                    CAPTCHA
                  </label>
                  <button
                    type="button"
                    onClick={initCaptchaSession}
                    disabled={captchaLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(139, 92, 246, 0.8)',
                      fontSize: '0.75rem',
                      cursor: captchaLoading ? 'not-allowed' : 'pointer',
                      padding: 0,
                    }}
                  >
                    {captchaLoading ? 'Loading...' : 'Refresh 🔄'}
                  </button>
                </div>

                {captchaImage ? (
                  <div style={{
                    padding: '10px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.9)',
                    border: `1px solid ${WB(0.1)}`,
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <img
                      src={captchaImage}
                      alt="CAPTCHA"
                      style={{
                        maxHeight: '44px',
                        width: 'auto',
                        borderRadius: '6px',
                      }}
                    />
                  </div>
                ) : (
                  <div style={{
                    padding: '14px',
                    borderRadius: '12px',
                    background: WB(0.05),
                    border: `1px solid ${WB(0.1)}`,
                    marginBottom: '10px',
                    textAlign: 'center',
                    color: W(0.4),
                    fontSize: '0.8rem',
                  }}>
                    {captchaLoading ? 'Fetching...' : 'Click Refresh'}
                  </div>
                )}

                <input
                  type="text"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  placeholder="Enter CAPTCHA text"
                  spellCheck={false}
                  style={inputStyle}
                  onFocus={(e) => e.target.style.borderColor = 'rgba(139, 92, 246, 0.5)'}
                  onBlur={(e) => e.target.style.borderColor = WB(0.1)}
                />
              </div>

              <AnimatePresence>
                {webLoginError && (
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
                    {webLoginError}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={webLoginLoading || captchaLoading || !captchaSessionId || activeAnimation !== null}
                whileTap={{ scale: 0.95 }}
                className={`arrow-btn arrow-btn--primary${webLoginLoading ? ' arrow-btn--disabled' : ''}`}
                style={{
                  cursor: webLoginLoading || captchaLoading || !captchaSessionId ? 'not-allowed' : 'pointer',
                  width: '100%',
                }}
              >
                <div className="arrow-btn__slider" />
                <svg className="arrow-btn__svg--arr1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <svg className="arrow-btn__svg--arr2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path d="M5 12h14m-7-7l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
                <span className="arrow-btn__text">
                  {webLoginLoading ? 'Logging in...' : 'Log in'}
                </span>
              </motion.button>

              <p style={{
                color: W(0.3),
                fontSize: '0.7rem',
                marginTop: '12px',
                lineHeight: 1.4,
                textAlign: 'center',
              }}>
                {captchaStep === 'credentials'
                  ? 'Same login as the SRM Student Portal. No credentials stored.'
                  : 'Solve the CAPTCHA to complete login. You\'ll get full access to all features.'}
              </p>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
