"use client";

import { useState } from 'react';
import { useTheme } from '@/lib/theme';

interface Props {
  src: string;
  title: string;
}

export default function HelperFrame({ src, title }: Props) {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <span style={{ fontSize: '2.5rem' }}>🔗</span>
        <p style={{ color: theme.text, fontSize: '0.9rem', fontWeight: 600, margin: 0 }}>
          Couldn&apos;t load {title}
        </p>
        <p style={{ color: theme.textFaint, fontSize: '0.78rem', margin: 0 }}>
          Check your internet connection and try again.
        </p>
        <button
          onClick={() => { setFailed(false); setLoading(true); }}
          style={{
            marginTop: '8px',
            padding: '10px 24px',
            borderRadius: '12px',
            background: theme.accent,
            color: '#fff',
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100dvh - 140px)' }}>
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            border: `3px solid ${theme.border}`,
            borderTopColor: theme.accent,
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <iframe
        src={src}
        title={title}
        onLoad={() => setLoading(false)}
        onError={() => setFailed(true)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '14px',
          background: theme.bg,
          opacity: loading ? 0 : 1,
          transition: 'opacity 0.25s',
        }}
      />
    </div>
  );
}
