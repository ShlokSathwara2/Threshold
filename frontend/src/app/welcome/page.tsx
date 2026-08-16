"use client";

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { motion } from 'framer-motion';

const ThresholdText = dynamic(() => import('@/components/effects/ThresholdText'), { ssr: false });
const RippleDistortion = dynamic(() => import('@/components/effects/RippleDistortion'), { ssr: false });

const tagline = "Attendance, marks, CGPA — finally in one intelligent dashboard.";
const taglineWords = tagline.split(' ');

const features = [
  { title: 'Attendance', description: 'Per-subject tracking with bunk calculator & margin alerts', color: '#22c55e', icon: 'attendance' },
  { title: 'Marks & CGPA', description: 'Grade-target calculator, SGPA/CGPA tools & what-if simulator', color: '#3b82f6', icon: 'marks' },
  { title: 'Smart Fallback', description: 'Dual sources — Academia + Student Portal, auto-failover', color: '#f59e0b', icon: 'fallback' },
  { title: 'Leave Planner', description: 'Project attendance impact before you take leaves', color: '#ef4444', icon: 'leave' },
  { title: 'Exam Readiness', description: 'Risk scores combining attendance + marks + test weightage', color: '#8b5cf6', icon: 'exam' },
  { title: 'Privacy First', description: 'Your password never touches our servers — ever', color: '#06b6d4', icon: 'privacy' },
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
    marks: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    fallback: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
      </svg>
    ),
    leave: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
      </svg>
    ),
    exam: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    privacy: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  };
  return <>{icons[type]}</>;
};

export default function WelcomePage() {
  const router = useRouter();
  const [starting, setStarting] = useState(false);

  const handleGetStarted = () => {
    if (starting) return;
    setStarting(true);
    window.setTimeout(() => router.push('/login'), 750);
  };

  return (
    <div style={{ position: 'relative', minHeight: '100dvh', background: '#09090f' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
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
          {/* ThresholdText — only animation in this zone */}
          <div
            style={{ width: '100%', maxWidth: '500px', height: '160px', position: 'relative', zIndex: 5 }}
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
              fontSize="clamp(2.5rem, 10vw, 4rem)"
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
                  color: 'rgba(255,255,255,0.75)',
                  marginRight: '6px',
                }}
              >
                {word}
              </motion.span>
            ))}
          </motion.p>

          {/* Get Started — sliding arrow button */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3.0, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            style={{ marginTop: '36px' }}
          >
            <button
              className={`get-started-btn${starting ? ' get-started-btn--animating' : ''}`}
              disabled={starting}
              onClick={handleGetStarted}
            >
              <div className="get-started-btn__slider">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </div>
              <span className="get-started-btn__text">Get Started</span>
            </button>
          </motion.div>
        </section>

        {/* Features — mobile: single column, compact cards */}
        <section style={{ padding: '32px 16px 48px', width: '100%' }}>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              fontSize: '1.15rem',
              color: 'rgba(255,255,255,0.7)',
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
                whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.06)' }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
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
                  <p style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: '2px' }}>
                    {feature.title}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
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
