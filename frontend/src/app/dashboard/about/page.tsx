"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { isSpLoggedIn } from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

const LINKS = {
  github: 'https://github.com/ShlokSathwara2',
  githubHandle: 'ShlokSathwara2',
  linkedin: 'https://www.linkedin.com/in/shlok-sathwara-4b91ab319/',
  linkedinHandle: 'shlok-sathwara',
};

const SOCIALS = [
  {
    key: 'github' as const,
    label: 'GitHub',
    icon: '⌘',
    color: '#c9d1d9',
    bg: 'rgba(201, 209, 217, 0.1)',
  },
  {
    key: 'linkedin' as const,
    label: 'LinkedIn',
    icon: 'in',
    color: '#0a66c2',
    bg: 'rgba(10, 102, 194, 0.12)',
  },
];

export default function AboutPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  useEffect(() => {
    if (!isSpLoggedIn()) router.push('/sp-login');
  }, [router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{
          padding: '28px 18px',
          borderRadius: '20px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 240, damping: 18 }}
          style={{
            width: '86px',
            height: '86px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: `2px solid ${theme.accent}55`,
            boxShadow: `0 12px 40px ${theme.glow}, 0 0 30px ${theme.accent}33`,
            marginBottom: '16px',
          }}
        >
          <img
            src="/about-photo.jpg"
            alt="Shlok Sathwara"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </motion.div>

        <h1 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: theme.text }}>
          Shlok Sathwara
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: W(0.45), lineHeight: 1.55, maxWidth: '300px' }}>
          Student &amp; product engineer · SRM Institute of Science &amp; Technology
          <br />
          I build tools that turn campus data into decisions.
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.04 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '10px' }}>
          Why I built this
        </h2>
        <p style={{ margin: 0, fontSize: '0.78rem', color: W(0.5), lineHeight: 1.65 }}>
          Every SRM student has asked the same two questions: <em>how many classes can I skip today</em>,
          and <em>exactly how many do I need to attend to stay above 75%</em>. The portal answers with
          raw numbers — you&apos;re left doing the math in your head, and one wrong weekend can cost you a
          detention notice.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: W(0.5), lineHeight: 1.65 }}>
          Threshold exists to remove that mental math. It reads your timetable, day orders and
          attendance, then answers in decisions: <strong style={{ color: theme.accentText }}>attend till this date</strong>,{' '}
          <strong style={{ color: theme.accentText }}>skip this class safely</strong>,{' '}
          <strong style={{ color: theme.accentText }}>this leave will put you at risk</strong> — before they happen, not after.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: W(0.5), lineHeight: 1.65 }}>
          Built during my own semester, as a student who needed it. Offline-first and private by design:
          your password never touches the server, and everything runs on this device.
        </p>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '12px' }}>
          Find me online
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SOCIALS.map((s) => {
            const href = LINKS[s.key];
            const ready = href && href !== '#';
            return (
              <a
                key={s.key}
                href={ready ? href : undefined}
                target={ready ? '_blank' : undefined}
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '13px 14px',
                  borderRadius: '14px',
                  background: s.bg,
                  border: `1px solid ${s.color}40`,
                  textDecoration: 'none',
                  cursor: ready ? 'pointer' : 'default',
                  opacity: ready ? 1 : 0.55,
                  transition: 'opacity 0.2s',
                }}
              >
                <span style={{
                  flexShrink: 0,
                  width: '38px',
                  height: '38px',
                  borderRadius: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0,0,0,0.35)',
                  border: `1px solid ${s.color}33`,
                  color: s.color,
                  fontSize: '1.05rem',
                  fontWeight: 800,
                }}>
                  {s.icon}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: theme.text }}>
                    {s.label}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.7rem', color: W(0.45), marginTop: '1px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ready ? LINKS[`${s.key}Handle`] : 'Link coming soon'}
                  </span>
                </span>
                {ready && (
                  <span style={{ flexShrink: 0, fontSize: '0.85rem', color: s.color }}>↗</span>
                )}
              </a>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        style={{
          padding: '18px',
          borderRadius: '18px',
          background: WB(0.03),
          border: `1px solid ${WB(0.08)}`,
        }}
      >
        <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: theme.text, marginBottom: '10px' }}>
          About Threshold
        </h2>
        <p style={{ margin: 0, fontSize: '0.78rem', color: W(0.5), lineHeight: 1.65 }}>
          Threshold keeps your attendance, marks, exam plans and habits on this device —
          private, offline-first, and built for SRM students who want the numbers, not the noise.
          All settings (notifications, tap sounds, app lock) are off by default — you choose
          what to enable. If you spot a bug or have a feature request, feel free to reach out
          on LinkedIn above.
        </p>
        <p style={{ margin: '10px 0 0', fontSize: '0.68rem', color: W(0.3), fontWeight: 600 }}>
          NEXT.JS · CAPACITOR · SRM STUDENT PORTAL
        </p>
      </motion.section>
    </div>
  );
}