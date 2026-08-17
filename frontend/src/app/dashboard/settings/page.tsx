"use client";

import { motion } from 'framer-motion';
import { useTheme, THEMES, hexToRgba } from '@/lib/theme';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isSpLoggedIn } from '@/lib/api';

function Toggle({ checked, onChange, accent }: { checked: boolean; onChange: () => void; accent: string }) {
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
        background: checked ? accent : 'rgba(255,255,255,0.12)',
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

function FooterCredit({ textColor }: { textColor: string }) {
  return (
    <p style={{
      textAlign: 'center',
      fontSize: '0.72rem',
      color: textColor,
      margin: '28px 0 8px',
      letterSpacing: '0.3px',
    }}>
      Made by <span style={{ fontWeight: 700 }}>Shlok Sathwara</span> ✦
    </p>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, notif, setNotif } = useTheme();

  useEffect(() => {
    if (!isSpLoggedIn()) router.push('/sp-login');
  }, [router]);

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', paddingBottom: '10px' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '20px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '4px' }}>
          Settings
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.8rem' }}>
          Theme, notifications &amp; about
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
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '14px',
        }}
      >
        <h2 style={{
          fontSize: '0.9rem', fontWeight: 700, color: 'white', marginBottom: '4px',
        }}>
          Theme
        </h2>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: '14px' }}>
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
                  background: active ? t.accentDim : 'rgba(255,255,255,0.02)',
                  border: active ? `1px solid ${t.accent}55` : '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '4px' }}>
                  {t.swatch.map((c, i) => (
                    <span key={i} style={{
                      width: '16px', height: '16px', borderRadius: '5px', background: c,
                      border: '1px solid rgba(255,255,255,0.15)',
                    }} />
                  ))}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: '0.83rem', fontWeight: 600, margin: 0,
                    color: active ? hexToRgba(theme.text, 0.95) : 'rgba(255,255,255,0.75)',
                  }}>
                    {t.name}
                  </p>
                  <p style={{
                    fontSize: '0.68rem', margin: '2px 0 0',
                    color: 'rgba(255,255,255,0.35)',
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
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          marginBottom: '14px',
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
          Notifications
        </h2>
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', marginBottom: '14px' }}>
          Master switch stops everything; category toggles silence just one type
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <div>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', margin: 0 }}>
                Master toggle
              </p>
              <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
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
            { key: 'attendanceRisk' as const, label: 'Attendance-risk alerts', desc: 'Dropping below 75% in a subject' },
            { key: 'examDates' as const, label: 'Exam-date reminders', desc: 'Upcoming tests and exams' },
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
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.05)',
                opacity: notif.enabled ? 1 : 0.45,
                transition: 'opacity 0.2s',
              }}
            >
              <div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', margin: 0 }}>
                  {c.label}
                </p>
                <p style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>
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

      {/* About */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white', marginBottom: '10px' }}>
          About
        </h2>
        <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
          THRESHOLD — your semester copilot. Attendance, marks, timetable, and calendar
          from the Student Portal &amp; Academia, interpreted into decisions.
        </p>
        <p style={{
          fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', margin: '10px 0 0',
        }}>
          v0.9.0 · Phase 8 Premium UI
        </p>
        <FooterCredit textColor="rgba(255,255,255,0.35)" />
      </motion.section>
    </div>
  );
}