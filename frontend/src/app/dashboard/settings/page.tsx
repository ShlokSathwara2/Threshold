"use client";

import { motion } from 'framer-motion';
import { useTheme, THEMES, hexToRgba, overlay, overlayBg } from '@/lib/theme';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isSpLoggedIn } from '@/lib/api';
import { clearAllCaches } from '@/lib/cache';
import { clearSkipLog } from '@/lib/habits';
import { clearOptionalHours } from '@/lib/optional-hours';
import { BiometricLock, appLockEnabled, setAppLockEnabled } from '@/lib/applock';
import { isNativePlatform } from '@/lib/capacitor';
import InstallApp from '@/components/ui/InstallApp';

function Toggle({ checked, onChange, accent }: { checked: boolean; onChange: () => void; accent: string }) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  return (
    <button
      onClick={onChange}
      aria-checked={checked}
      role="switch"
      style={{
        width: '46px',
        height: '26px',
        borderRadius: '999px',
        border: 'none',
        cursor: 'pointer',
        background: checked ? accent : WB(0.12),
        position: 'relative',
        transition: 'background 0.25s',
        flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute',
        top: '3px',
        left: checked ? '23px' : '3px',
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.25s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
      }} />
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, notif, setNotif } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [flash, setFlash] = useState('');
  const [lockOn, setLockOn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSpLoggedIn()) router.push('/sp-login');
  }, [router]);

  useEffect(() => {
    setLockOn(appLockEnabled());
    let mounted = true;
    BiometricLock.isAvailable()
      .then((r) => {
        console.log('[applock] isAvailable:', r);
        if (mounted) setBioAvailable(r.available && r.enrolled);
      })
      .catch((e) => {
        console.log('[applock] isAvailable threw:', e);
        if (mounted) setBioAvailable(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const flashDone = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(''), 2200);
  };

  const handleLockToggle = async () => {
    if (!lockOn) {
      if (!isNativePlatform()) {
        flashDone('App lock is only available in the Android app');
        return;
      }
      if (bioAvailable === false) {
        flashDone('Set up fingerprint / face / PIN in Android settings first');
        return;
      }
      try {
        console.log('[applock] attempting authenticate, bioAvailable =', bioAvailable);
        await BiometricLock.authenticate({ reason: 'Confirm you can unlock Threshold' });
        setAppLockEnabled(true);
        setLockOn(true);
        flashDone('App lock enabled ✓');
      } catch (e) {
        console.log('[applock] authenticate rejected:', e);
        flashDone('Cancelled — app lock not enabled');
      }
      return;
    }
    setAppLockEnabled(false);
    setLockOn(false);
    flashDone('App lock disabled ✓');
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '10px' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '20px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: theme.text, marginBottom: '4px' }}>
          Settings
        </h1>
        <p style={{ color: W(0.35), fontSize: '0.8rem' }}>
          Theme, security, notifications, data &amp; about
        </p>
      </motion.div>

      {/* Theme picker */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
          marginBottom: '14px',
        }}
      >
        <h2 style={{
          fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '4px',
        }}>
          Theme
        </h2>
        <p style={{ fontSize: '0.72rem', color: W(0.35), marginBottom: '14px' }}>
          Five distinct looks — choice is saved on this device
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {THEMES.map((t) => {
            const active = t.id === theme.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: active ? t.accentDim : WB(0.02),
                  border: active ? `1px solid ${t.accent}55` : `1px solid ${WB(0.06)}`,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '4px' }}>
                  {t.swatch.map((c, i) => (
                    <span key={i} style={{
                      width: '16px', height: '16px', borderRadius: '5px', background: c,
                      border: `1px solid ${WB(0.15)}`,
                    }} />
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.83rem', fontWeight: 600, margin: 0,
                    color: active ? hexToRgba(theme.text, 0.95) : W(0.75),
                  }}>
                    {t.name}
                  </p>
                  <p style={{
                    fontSize: '0.68rem', margin: '2px 0 0',
                    color: W(0.35),
                  }}>
                    {t.desc}
                  </p>
                </div>
                {active && (
                  <span style={{
                    fontSize: '0.75rem', fontWeight: 800, color: t.accentText,
                  }}>
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Notification settings */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
          marginBottom: '14px',
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '4px' }}>
          Notifications
        </h2>
        <p style={{ fontSize: '0.72rem', color: W(0.35), marginBottom: '14px' }}>
          Master switch stops everything; category toggles silence just one type
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, margin: 0 }}>
                Master toggle
              </p>
              <p style={{ fontSize: '0.68rem', color: W(0.35), margin: '2px 0 0' }}>
                No notifications fire when off
              </p>
            </div>
            <Toggle
              checked={notif.enabled}
              onChange={() => setNotif({ enabled: !notif.enabled })}
              accent={theme.accent}
            />
          </div>

          {[
            { key: 'attendanceRisk' as const, label: 'Attendance-risk alerts', desc: 'Subjects below 75% — shown in dashboard alerts' },
            { key: 'examDates' as const, label: 'Exam-date reminders', desc: 'Exams within the next few days' },
            { key: 'holidays' as const, label: 'Holiday alerts', desc: 'Upcoming academic holidays' },
          ].map((c) => (
            <div
              key={c.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '12px 14px',
                borderRadius: '12px',
                background: WB(0.02),
                border: `1px solid ${WB(0.05)}`,
                opacity: notif.enabled ? 1 : 0.45,
                transition: 'opacity 0.2s',
              }}
            >
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: theme.text, margin: 0 }}>
                  {c.label}
                </p>
                <p style={{ fontSize: '0.66rem', color: W(0.35), margin: '2px 0 0' }}>
                  {c.desc}
                </p>
              </div>
              <Toggle
                checked={notif.enabled && notif[c.key]}
                onChange={() => setNotif({ [c.key]: !notif[c.key] })}
                accent={theme.accent}
              />
            </div>
          ))}
        </div>
      </motion.section>

      {/* Trust & security */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.13 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
          marginBottom: '14px',
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '4px' }}>
          Trust &amp; security
        </h2>
        <p style={{ fontSize: '0.72rem', color: W(0.35), marginBottom: '14px' }}>
          Guard the app itself — separate from the portal login
        </p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
          <div>
            <p style={{ fontSize: '0.82rem', fontWeight: 600, color: theme.text, margin: 0 }}>
              App lock
            </p>
            <p style={{ fontSize: '0.68rem', color: W(0.35), margin: '2px 0 0' }}>
              Fingerprint, face or device PIN on every open — keeps cached data safe
            </p>
          </div>
          <Toggle
            checked={lockOn}
            onChange={handleLockToggle}
            accent={theme.accent}
          />
        </div>

        {!lockOn && !isNativePlatform() && (
          <p style={{ margin: '12px 0 0', fontSize: '0.66rem', fontWeight: 600, color: '#fbbf24', lineHeight: 1.5 }}>
            App lock uses the phone&apos;s biometrics — available in the Android app. On web, it stays off.
          </p>
        )}

        {!lockOn && isNativePlatform() && bioAvailable === false && (
          <p style={{ margin: '12px 0 0', fontSize: '0.66rem', fontWeight: 600, color: '#fbbf24', lineHeight: 1.5 }}>
            Not available — set up a screen lock (fingerprint / face / PIN) in Android
            Settings, then come back here.
          </p>
        )}
      </motion.section>

      {/* Data & utilities */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.17 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
          marginBottom: '14px',
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '4px' }}>
          Data &amp; utilities
        </h2>
        <p style={{ fontSize: '0.72rem', color: W(0.35), marginBottom: '14px' }}>
          Everything below lives only on this device
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => {
              clearSkipLog();
              flashDone('Habit insights reset ✓');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ flexShrink: 0, fontSize: '1rem' }}>🧭</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text }}>
                Reset habit insights
              </span>
              <span style={{ display: 'block', fontSize: '0.66rem', color: W(0.35), marginTop: '2px' }}>
                Clears the skip log &amp; attendance snapshots (Insights page)
              </span>
            </span>
          </button>

          <button
            onClick={() => {
              clearOptionalHours();
              flashDone('Optional-hour marks cleared ✓');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ flexShrink: 0, fontSize: '1rem' }}>🕐</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text }}>
                Clear optional-hour marks
              </span>
              <span style={{ display: 'block', fontSize: '0.66rem', color: W(0.35), marginTop: '2px' }}>
                Removes every OPT toggle from the timetable
              </span>
            </span>
          </button>

          <button
            onClick={() => {
              clearAllCaches();
              flashDone('Cached data cleared ✓');
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '12px',
              background: WB(0.02),
              border: `1px solid ${WB(0.06)}`,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ flexShrink: 0, fontSize: '1rem' }}>🗄</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: theme.text }}>
                Clear cached portal data
              </span>
              <span style={{ display: 'block', fontSize: '0.66rem', color: W(0.35), marginTop: '2px' }}>
                Forces a fresh fetch of attendance, marks &amp; timetable
              </span>
            </span>
          </button>

          {flash && (
            <p style={{
              margin: 0,
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#4ade80',
              textAlign: 'center',
            }}>
              {flash}
            </p>
          )}
        </div>
      </motion.section>

      {/* About */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.21 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '10px' }}>
          About
        </h2>
        <p style={{ fontSize: '0.78rem', color: W(0.45), margin: 0, lineHeight: 1.6 }}>
          THRESHOLD — your semester copilot. Attendance with recovery plans, a bunk
          planner, cloud-synced exam tracking, smart notifications, a biometric app
          lock and instant refresh — all from the Student Portal &amp; Academia,
          interpreted into decisions. Your password never touches our servers.
        </p>
      </motion.section>

      {/* Install as app (web only) */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24 }}
        style={{
          padding: '14px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
        }}
      >
        <InstallApp />
      </motion.section>
    </div>
  );
}