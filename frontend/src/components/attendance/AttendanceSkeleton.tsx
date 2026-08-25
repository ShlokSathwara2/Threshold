"use client";

import { motion } from 'framer-motion';
import Skeleton from '@/components/ui/Skeleton';

export default function AttendanceSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: '700px', margin: '0 auto', padding: '0 16px' }}
    >
      {/* Summary ring skeleton */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        marginBottom: '16px',
        borderRadius: '18px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Skeleton width="120px" height="120px" borderRadius="50%" />
          <div style={{
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}>
            <Skeleton width="48px" height="24px" />
            <Skeleton width="32px" height="10px" />
          </div>
        </div>
      </div>

      {/* Stat pills skeleton */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width="80px" height="28px" borderRadius="999px" />
        ))}
      </div>

      {/* Subject cards skeleton */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            padding: '16px',
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <Skeleton width="36px" height="36px" borderRadius="10px" />
            <div style={{ flex: 1 }}>
              <Skeleton width="65%" height="14px" />
              <Skeleton width="35%" height="10px" style={{ marginTop: '6px' }} />
            </div>
            <Skeleton width="44px" height="44px" borderRadius="50%" />
          </div>
          <Skeleton width="100%" height="5px" borderRadius="3px" />
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <Skeleton width="56px" height="22px" borderRadius="999px" />
            <Skeleton width="48px" height="22px" borderRadius="999px" />
            <Skeleton width="52px" height="22px" borderRadius="999px" />
          </div>
        </div>
      ))}
    </motion.div>
  );
}
