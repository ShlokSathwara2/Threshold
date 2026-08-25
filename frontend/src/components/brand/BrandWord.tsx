"use client";

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

interface BrandWordProps {
  text?: string;
  fontSize?: string;
  fontWeight?: number;
  glow?: boolean;
}

const GRADIENT_COLORS = ['#a855f7', '#ec4899', '#f43f5e', '#f59e0b', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];

export default function BrandWord({
  text = 'THRESHOLD',
  fontSize = '1.25rem',
  fontWeight = 900,
  glow = true,
}: BrandWordProps) {
  const bgPosition = useMotionValue(0);
  const backgroundSize = 300;

  useEffect(() => {
    const controls = animate(bgPosition, backgroundSize, {
      duration: 4,
      repeat: Infinity,
      repeatType: 'loop',
      ease: 'linear',
    });
    return () => controls.stop();
  }, [bgPosition, backgroundSize]);

  const bgX = useTransform(bgPosition, (v) => `${v}%`);

  return (
    <motion.span
      initial={{ opacity: 0, y: -6, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.7, ease: [0.23, 1, 0.32, 1] }}
      style={{
        display: 'inline-block',
        fontSize,
        fontWeight,
        letterSpacing: '1px',
        lineHeight: 1.1,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        background: `linear-gradient(90deg, ${GRADIENT_COLORS.join(', ')})`,
        backgroundSize: `${backgroundSize}% auto`,
        backgroundPositionX: bgX,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        filter: glow ? 'drop-shadow(0 0 20px rgba(139,92,246,0.35))' : 'none',
      }}
    >
      {text}
    </motion.span>
  );
}
