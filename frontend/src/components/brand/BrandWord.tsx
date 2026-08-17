"use client";

import { motion } from 'framer-motion';

interface BrandWordProps {
  text?: string;
  fontSize?: string;
  fontWeight?: number;
  glow?: boolean;
}

const HUES = ['#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];

export default function BrandWord({
  text = 'THRESHOLD',
  fontSize = '1.25rem',
  fontWeight = 900,
  glow = true,
}: BrandWordProps) {
  const letters = text.split('');
  return (
    <motion.span
      initial={{ opacity: 0, y: -6, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      style={{
        display: 'inline-flex',
        fontSize,
        fontWeight,
        letterSpacing: '1px',
        lineHeight: 1.1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {letters.map((ch, i) => (
        <motion.span
          key={i}
          animate={{
            color: [
              HUES[i % HUES.length],
              HUES[(i + 2) % HUES.length],
              HUES[(i + 4) % HUES.length],
              HUES[i % HUES.length],
            ],
            filter: glow
              ? [
                  `drop-shadow(0 0 8px ${HUES[i % HUES.length]}88)`,
                  `drop-shadow(0 0 16px ${HUES[(i + 2) % HUES.length]}aa)`,
                  `drop-shadow(0 0 8px ${HUES[(i + 4) % HUES.length]}88)`,
                  `drop-shadow(0 0 8px ${HUES[i % HUES.length]}88)`,
                ]
              : 'none',
            y: [0, -2, 0],
          }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.14,
          }}
        >
          {ch}
        </motion.span>
      ))}
    </motion.span>
  );
}