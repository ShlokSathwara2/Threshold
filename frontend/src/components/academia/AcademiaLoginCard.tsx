"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  setAcademiaCookies,
  academiaLogin,
  type AcademiaLoginResponse,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

export default function AcademiaLoginCard({ onSuccess }: { onSuccess?: () => void }) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [captcha, setCaptcha] = useState<{ image: string; cdigest: string } | null>(null);
  const [captchaText, setCaptchaText] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setLoginError('Enter your academia username and password');
      return;
    }
    setLoggingIn(true);
    setLoginError('');
    try {
      const res: AcademiaLoginResponse = await academiaLogin(
        username.trim(),
        password,
        captcha?.cdigest,
        captcha ? captchaText.trim() : undefined
      );
      if (!res.success) {
        if (res.captcha) {
          setCaptcha(res.captcha);
          setCaptchaText('');
          setLoginError(res.message || 'Enter the CAPTCHA to continue');
        } else {
          setLoginError(res.message || 'Login failed — check your credentials');
        }
        return;
      }
      if (!res.cookies) {
        setLoginError('Login succeeded but no session was returned — try again');
        return;
      }
      setAcademiaCookies(res.cookies, username.trim());
      setCaptcha(null);
      setLoginError('');
      onSuccess?.();
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        padding: '20px',
        borderRadius: '18px',
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))',
        border: '1px solid rgba(34, 197, 94, 0.25)',
      }}
    >
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
        Academia login needed
      </h2>
      <p style={{ color: W(0.4), fontSize: '0.78rem', lineHeight: 1.5, marginBottom: '14px' }}>
        The timetable lives in academia, not the SP portal — and academia uses its own login
        (your SP credentials won&apos;t work here). Credentials are never saved on this device —
        log in whenever you want to load your timetable, and it stays yours only.
      </p>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Academia username (reg number)"
          autoCapitalize="none"
          autoCorrect="off"
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            border: `1px solid ${WB(0.1)}`,
            background: WB(0.04),
            color: theme.text,
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          style={{
            padding: '12px 14px',
            borderRadius: '12px',
            border: `1px solid ${WB(0.1)}`,
            background: WB(0.04),
            color: theme.text,
            fontSize: '0.9rem',
            outline: 'none',
          }}
        />
        {captcha && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px',
            borderRadius: '12px',
            background: WB(0.03),
            border: `1px solid ${WB(0.08)}`,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={captcha.image}
              alt="captcha"
              style={{ height: '40px', borderRadius: '8px', flexShrink: 0 }}
            />
            <input
              value={captchaText}
              onChange={(e) => setCaptchaText(e.target.value)}
              placeholder="Captcha text"
              autoCapitalize="none"
              style={{
                flex: 1,
                padding: '10px 12px',
                borderRadius: '10px',
                border: `1px solid ${WB(0.1)}`,
                background: WB(0.04),
                color: theme.text,
                fontSize: '0.85rem',
                outline: 'none',
              }}
            />
          </div>
        )}
        {loginError && (
          <p style={{ color: '#fca5a5', fontSize: '0.78rem', margin: 0 }}>{loginError}</p>
        )}
        <button
          type="submit"
          disabled={loggingIn}
          style={{
            padding: '12px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: loggingIn ? 'wait' : 'pointer',
            opacity: loggingIn ? 0.6 : 1,
          }}
        >
          {loggingIn ? 'Logging in…' : captcha ? 'Verify & load timetable' : 'Log in & load timetable'}
        </button>
      </form>
    </motion.div>
  );
}