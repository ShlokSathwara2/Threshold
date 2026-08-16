"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Mark } from '@/lib/api';
import {
  schemeFromTotal,
  gradeBandsForInternal,
  gradeForTotal,
  FULL_INTERNAL_THRESHOLD,
} from '@/lib/grade-calculator';

function parseNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export default function GradeTargetTool({ subject }: { subject?: Mark | null }) {
  const overallTotal = subject ? parseNum(subject.overall?.total ?? '') : 0;
  const scheme = schemeFromTotal(overallTotal);
  const [internal, setInternal] = useState<string>(subject?.overall?.scored ?? '');

  const internalScored = parseNum(internal);
  const internalTotal = scheme === 'full' && overallTotal > 0 ? overallTotal : 60;

  const currentGrade = gradeForTotal(internalScored);

  const bands = gradeBandsForInternal(internalScored, internalTotal);

  return (
    <div>
      {/* Scheme badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '8px',
        fontSize: '0.68rem',
        fontWeight: 600,
        marginBottom: '10px',
        background: scheme === 'full' ? 'rgba(139, 92, 246, 0.12)' : 'rgba(34, 197, 94, 0.1)',
        border: `1px solid ${scheme === 'full' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(34, 197, 94, 0.25)'}`,
        color: scheme === 'full' ? '#c4b5fd' : '#86efac',
      }}>
        {scheme === 'full'
          ? `Fully internal (total ${overallTotal} > ${FULL_INTERNAL_THRESHOLD} — no end sem)`
          : 'Internal + end sem (60/40 — exam 75 → 40)'}
      </div>

      {!subject && (
        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
          No portal marks for this subject yet — enter internal marks manually below.
        </p>
      )}

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <label style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>
          Internal marks:
        </label>
        <input
          type="number"
          min={0}
          max={internalTotal}
          value={internal}
          onChange={(e) => setInternal(e.target.value)}
          placeholder="0"
          inputMode="decimal"
          style={{
            width: '84px',
            padding: '8px 10px',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            color: 'white',
            fontSize: '0.9rem',
            fontWeight: 700,
            outline: 'none',
          }}
        />
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)' }}>/ {internalTotal}</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: '0.8rem',
          fontWeight: 700,
          color: '#a78bfa',
        }}>
          {internalScored > 0 ? `${currentGrade.grade} (${currentGrade.gp} GP)` : ''}
        </span>
      </div>

      {scheme === 'full' ? (
        <div style={{
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid rgba(139, 92, 246, 0.2)',
          fontSize: '0.78rem',
          color: 'rgba(255,255,255,0.6)',
        }}>
          Fully internal — no end-sem exam to back-calculate. Current standing:{' '}
          <span style={{ color: '#c4b5fd', fontWeight: 700 }}>
            {internalScored}/{internalTotal} ({overallTotal > 0 ? ((internalScored / internalTotal) * 100).toFixed(1) : '0.0'}%)
          </span>{' '}
          → <span style={{ color: '#c4b5fd', fontWeight: 700 }}>{currentGrade.grade}</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {bands.map((band, i) => {
            const achieved = band.required === null;
            return (
              <motion.div
                key={band.grade}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 10px',
                  borderRadius: '10px',
                  background: band.impossible ? 'rgba(239, 68, 68, 0.06)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${band.impossible ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.04)'}`,
                }}
              >
                <span style={{
                  minWidth: '30px',
                  height: '30px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.75rem',
                  color: band.grade === currentGrade.grade ? '#09090f' : '#c4b5fd',
                  background: band.grade === currentGrade.grade ? '#c4b5fd' : 'rgba(139, 92, 246, 0.15)',
                }}>
                  {band.grade}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', minWidth: '46px' }}>
                  ≥ {band.min}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: band.impossible ? '#f87171' : achieved ? '#22c55e' : 'rgba(255,255,255,0.7)',
                  flex: 1,
                  textAlign: 'right',
                }}>
                  {band.impossible
                    ? 'Impossible'
                    : achieved
                      ? 'Already achieved'
                      : `Need ${band.required} of 40 in exam (${band.requiredRaw} of 75)`}
                </span>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}