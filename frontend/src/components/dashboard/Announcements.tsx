"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchSpAnnouncements, type AnnouncementsResponse } from '@/lib/api';
import { getCached, setCached } from '@/lib/cache';
import { useTheme, overlay, overlayBg } from '@/lib/theme';

const CACHE_KEY = 'announcements';
const TTL = 1000 * 60 * 60 * 6; // 6h

interface Props {
  onLoaded?: (count: number) => void;
}

export default function Announcements({ onLoaded }: Props) {
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [rows, setRows] = useState<AnnouncementsResponse['rows'] | null>(null);

  useEffect(() => {
    let mounted = true;
    const cached = getCached<AnnouncementsResponse>(CACHE_KEY);
    if (cached?.data.rows?.length && Date.now() - cached.savedAt < TTL) {
      setRows(cached.data.rows);
      onLoaded?.(cached.data.rows.length);
    }
    fetchSpAnnouncements()
      .then((res) => {
        if (!mounted || !res.rows?.length) return;
        setCached<AnnouncementsResponse>(CACHE_KEY, res);
        setRows(res.rows);
        onLoaded?.(res.rows.length);
      })
      .catch(() => {
        /* backend unreachable — card stays hidden */
      });
    return () => {
      mounted = false;
    };
  }, [onLoaded]);

  if (!rows?.length) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      style={{
        borderRadius: '18px',
        background: WB(0.02),
        border: `1px solid ${WB(0.06)}`,
        padding: '16px 16px 12px',
        marginBottom: '14px',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '10px',
      }}>
        <span style={{ fontSize: '1rem' }}>📢</span>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 800, color: theme.text, margin: 0 }}>
          Announcements
        </h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rows.slice(0, 6).map((r, i) => (
          <div key={i} style={{
            padding: '10px 12px',
            borderRadius: '12px',
            background: WB(0.02),
            border: `1px solid ${WB(0.05)}`,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '8px',
            }}>
              <p style={{
                margin: 0,
                fontSize: '0.72rem',
                fontWeight: 700,
                color: theme.text,
                flex: 1,
              }}>
                {r.title || 'Notice'}
              </p>
              <span style={{
                fontSize: '0.62rem',
                color: W(0.4),
                whiteSpace: 'nowrap',
              }}>
                {r.date}
              </span>
            </div>
            {r.body && (
              <p style={{
                margin: '4px 0 0',
                fontSize: '0.68rem',
                color: W(0.55),
                lineHeight: 1.5,
              }}>
                {r.body}
              </p>
            )}
          </div>
        ))}
      </div>
    </motion.section>
  );
}