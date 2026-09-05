"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { isLoggedIn } from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import {
  loadStepClasses,
  addStepClass,
  removeStepClass,
  updateStepClass,
  syncStepFromCloud,
  getTodayClasses,
  type ScheduleClassEntry,
} from '@/lib/schedule-classes';
import AddClassModal from '@/components/schedule/AddClassModal';
import ClassCard from '@/components/schedule/ClassCard';

export default function StepPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);

  const [classes, setClasses] = useState<ScheduleClassEntry[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editEntry, setEditEntry] = useState<ScheduleClassEntry | null>(null);

  useEffect(() => {
    if (!isLoggedIn()) router.push('/welcome');
  }, [router]);

  useEffect(() => {
    setClasses(loadStepClasses());
  }, []);

  useEffect(() => {
    let mounted = true;
    syncStepFromCloud().then((cloud) => {
      if (mounted && cloud) setClasses(cloud);
    });
    return () => { mounted = false; };
  }, []);

  const todayClasses = getTodayClasses(classes);

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--threshold-bg)',
      color: 'var(--threshold-text)',
      paddingBottom: '120px',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.3rem',
            fontWeight: 800,
            margin: 0,
            background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            STEP Classes
          </h1>
          <p style={{
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.4)',
            margin: '4px 0 0',
          }}>
            {classes.length === 0
              ? 'No classes added yet'
              : `${classes.length} class${classes.length === 1 ? '' : 'es'} · ${todayClasses.length} today`}
          </p>
        </div>
        <button
          onClick={() => { setEditEntry(null); setShowModal(true); }}
          style={{
            padding: '10px 18px',
            borderRadius: '12px',
            border: 'none',
            background: 'linear-gradient(135deg, rgba(34,211,238,0.8), rgba(6,182,212,0.6))',
            color: 'white',
            fontSize: '0.8rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(34,211,238,0.3)',
          }}
        >
          + Add Class
        </button>
      </div>

      {/* Today's classes */}
      {todayClasses.length > 0 && (
        <div style={{ padding: '0 20px', marginTop: '16px' }}>
          <h2 style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.8px',
            marginBottom: '10px',
          }}>
            TODAY&apos;S CLASSES
          </h2>
          {todayClasses.map((entry) => (
            <ClassCard
              key={entry.id}
              entry={entry}
              type="step"
              accentColor="#22d3ee"
              onEdit={(e) => { setEditEntry(e); setShowModal(true); }}
              onDelete={(id) => setClasses(removeStepClass(id))}
            />
          ))}
        </div>
      )}

      {/* All classes */}
      <div style={{ padding: '0 20px', marginTop: '16px' }}>
        <h2 style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.35)',
          letterSpacing: '0.8px',
          marginBottom: '10px',
        }}>
          ALL CLASSES
        </h2>
        {classes.length === 0 ? (
          <div style={{
            padding: '40px 20px',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.3)',
            fontSize: '0.82rem',
          }}>
            <p style={{ fontSize: '2rem', margin: '0 0 12px' }}>△</p>
            <p style={{ margin: 0, fontWeight: 600 }}>No STEP classes yet</p>
            <p style={{ margin: '8px 0 0', fontSize: '0.72rem' }}>
              Tap &quot;+ Add Class&quot; to create your first one.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {classes.map((entry) => (
              <ClassCard
                key={entry.id}
                entry={entry}
                type="step"
                accentColor="#22d3ee"
                onEdit={(e) => { setEditEntry(e); setShowModal(true); }}
                onDelete={(id) => setClasses(removeStepClass(id))}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <AddClassModal
          type="step"
          editEntry={editEntry}
          onSave={(entry) => {
            if (editEntry) {
              setClasses(updateStepClass(editEntry.id, entry));
            } else {
              setClasses(addStepClass(entry));
            }
          }}
          onClose={() => { setShowModal(false); setEditEntry(null); }}
        />
      )}
    </div>
  );
}
