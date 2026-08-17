"use client";

import { motion } from 'framer-motion';
import { useTheme, overlay } from '@/lib/theme';

export function LoadingState({ label }: { label: string }) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60dvh',
      gap: '16px',
    }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(139, 92, 246, 0.2)',
          borderTopColor: 'var(--threshold-accent)',
          borderRadius: '50%',
        }}
      />
      <p style={{ color: W(0.4), fontSize: '0.85rem' }}>{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60dvh',
      gap: '16px',
      padding: '20px',
    }}>
      <div style={{
        padding: '20px',
        borderRadius: '16px',
        background: 'rgba(239, 68, 68, 0.08)',
        border: '1px solid rgba(239, 68, 68, 0.2)',
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        <p style={{ color: '#fca5a5', fontSize: '0.9rem', marginBottom: onRetry ? '12px' : 0 }}>
          {message}
        </p>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--threshold-accent-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
  onRefresh,
}: {
  title: string;
  hint?: string;
  icon?: string;
  onRefresh?: () => void;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60dvh',
      gap: '16px',
      padding: '20px',
    }}>
      <div style={{
        padding: '24px 20px',
        borderRadius: '16px',
        background: 'rgba(139, 92, 246, 0.08)',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        textAlign: 'center',
        maxWidth: '400px',
      }}>
        {icon && (
          <div style={{
            width: '44px',
            height: '44px',
            margin: '0 auto 12px',
            borderRadius: '13px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(139, 92, 246, 0.15)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            fontSize: '1.2rem',
            color: 'var(--threshold-accent-text)',
          }}>
            {icon}
          </div>
        )}
        <p style={{
          color: 'var(--threshold-accent-text)',
          fontSize: '0.95rem',
          fontWeight: 700,
          marginBottom: hint ? '6px' : 0,
        }}>
          {title}
        </p>
        {hint && (
          <p style={{
            color: 'var(--threshold-text-faint)',
            fontSize: '0.78rem',
            lineHeight: 1.5,
          }}>
            {hint}
          </p>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={{
              marginTop: '14px',
              padding: '10px 24px',
              borderRadius: '10px',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.15)',
              color: 'var(--threshold-accent-text)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refresh
          </button>
        )}
      </div>
    </div>
  );
}