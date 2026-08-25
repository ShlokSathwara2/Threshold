"use client";

import { motion } from 'framer-motion';
import Skeleton from '@/components/ui/Skeleton';

export default function DashboardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{ maxWidth: '700px', margin: '0 auto', padding: '0 16px' }}
    >
      {/* Hero skeleton */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '20px',
        padding: '20px',
        borderRadius: '18px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Skeleton width="72px" height="72px" borderRadius="50%" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width="60%" height="16px" />
          <Skeleton width="40%" height="12px" />
        </div>
        <Skeleton width="48px" height="48px" borderRadius="50%" />
      </div>

      {/* Stats grid skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '12px',
        marginBottom: '24px',
      }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              padding: '18px',
              borderRadius: '18px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <Skeleton width="64px" height="64px" borderRadius="50%" />
            <Skeleton width="50px" height="14px" />
            <Skeleton width="70px" height="10px" />
          </div>
        ))}
      </div>

      {/* Brief cards skeleton */}
      <div style={{
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
        marginBottom: '24px',
      }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Skeleton width="120px" height="14px" />
        </div>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 16px',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}
          >
            <Skeleton width="8px" height="8px" borderRadius="50%" />
            <Skeleton width="80px" height="12px" borderRadius="6px" />
            <Skeleton width="60%" height="12px" />
          </div>
        ))}
      </div>

      {/* Subject cards skeleton */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            padding: '16px',
            borderRadius: '18px',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)',
            marginBottom: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <Skeleton width="40px" height="40px" borderRadius="12px" />
            <div style={{ flex: 1 }}>
              <Skeleton width="70%" height="14px" />
              <Skeleton width="40%" height="10px" style={{ marginTop: '6px' }} />
            </div>
            <Skeleton width="48px" height="48px" borderRadius="50%" />
          </div>
          <Skeleton width="100%" height="6px" borderRadius="3px" />
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            <Skeleton width="60px" height="24px" borderRadius="999px" />
            <Skeleton width="50px" height="24px" borderRadius="999px" />
            <Skeleton width="55px" height="24px" borderRadius="999px" />
          </div>
        </div>
      ))}
    </motion.div>
  );
}
