"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Mark } from '@/lib/api';
import { schemeFromTotal } from '@/lib/grade-calculator';
import SubjectMarksChart from './SubjectMarksChart';
import GradeTargetTool from './GradeTargetTool';

function parseNum(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export default function SubjectMarksCard({ subject, index }: { subject: Mark; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const overallTotal = parseNum(subject.overall?.total ?? '');
  const scheme = schemeFromTotal(overallTotal);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          cursor: 'pointer',
          gap: '10px',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 600, color: '#a78bfa', marginBottom: '2px' }}>
            {subject.courseCode} · {subject.courseType}
          </p>
          <h3 style={{
            fontSize: '0.9rem',
            fontWeight: 600,
            color: 'white',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {subject.courseName}
          </h3>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{
            fontSize: '1rem',
            fontWeight: 800,
            color: scheme === 'full' ? '#c4b5fd' : '#86efac',
            margin: 0,
          }}>
            {subject.overall?.scored || '0'}
            <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>
              /{subject.overall?.total || '0'}
            </span>
          </p>
          <p style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
            {scheme === 'full' ? '100% internal' : '60+40 scheme'} {expanded ? '▾' : '▸'}
          </p>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ paddingTop: '14px' }}>
            <SubjectMarksChart subject={subject} />
          </div>
          <div style={{
            marginTop: '14px',
            padding: '14px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>
              Grade Target Calculator
            </p>
            <GradeTargetTool subject={subject} />
          </div>
        </div>
      )}
    </motion.div>
  );
}