"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  isSpLoggedIn,
  fetchSpProfile,
  fetchSpPersonalDetails,
  fetchUser,
  isAcademiaLoggedIn,
  type SpProfile,
  type PersonalDetailsResponse,
  type User,
} from '@/lib/api';
import { useTheme, overlay, overlayBg } from '@/lib/theme';
import { usePullToRefresh } from '@/components/ui/PullRefresh';

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value) return null;
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '12px 4px',
      borderBottom: `1px solid ${WB(0.05)}`,
    }}>
      <span style={{ fontSize: '0.75rem', color: W(0.4) }}>{label}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--threshold-text)', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const { theme } = useTheme();
  const W = (a: number) => overlay(theme, a);
  const WB = (a: number) => overlayBg(theme, a);
  const [profile, setProfile] = useState<SpProfile | null>(null);
  const [academia, setAcademia] = useState<User | null>(null);
  const [personal, setPersonal] = useState<PersonalDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [spRes, acaRes, pdRes] = await Promise.allSettled([
        fetchSpProfile(),
        isAcademiaLoggedIn()
          ? fetchUser()
          : Promise.resolve(null as User | null),
        fetchSpPersonalDetails(),
      ]);
      if (spRes.status === 'fulfilled' && spRes.value.profile) {
        setProfile(spRes.value.profile);
      }
      if (acaRes.status === 'fulfilled' && acaRes.value) {
        setAcademia(acaRes.value);
      }
      if (pdRes.status === 'fulfilled' && !pdRes.value.error) {
        setPersonal(pdRes.value);
      }
      if (spRes.status === 'rejected' && acaRes.status === 'rejected') {
        throw new Error('Could not load profile data');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSpLoggedIn()) {
      router.push('/sp-login');
      return;
    }
    load();
  }, [router, load]);
  usePullToRefresh(load);

  const name = profile?.name || academia?.name;
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('') || '?';

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '16px', paddingTop: '4px' }}
      >
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--threshold-text)', marginBottom: '4px' }}>
          Profile
        </h1>
        <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
          Your student details from the portal
        </p>
      </motion.div>

      {loading ? (
        <div style={{
          padding: '24px',
          borderRadius: '16px',
          background: 'var(--threshold-surface)',
          border: `1px solid ${WB(0.06)}`,
          textAlign: 'center',
        }}>
          <p style={{ color: 'var(--threshold-text-faint)', fontSize: '0.8rem' }}>
            Loading profile…
          </p>
        </div>
      ) : error && !profile && !academia ? (
        <div style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(239, 68, 68, 0.06)',
          border: '1px solid rgba(239, 68, 68, 0.15)',
        }}>
          <p style={{ color: '#fca5a5', fontSize: '0.78rem', margin: 0 }}>{error}</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            borderRadius: '20px',
            background: `linear-gradient(160deg, rgba(139, 92, 246, 0.12), ${WB(0.02)})`,
            border: '1px solid rgba(139, 92, 246, 0.2)',
            padding: '20px',
            marginBottom: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {profile?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.photo}
                alt="Student"
                style={{
                  width: '72px',
                  height: '72px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '2px solid rgba(139, 92, 246, 0.5)',
                  flexShrink: 0,
                }}
              />
            ) : (
              <div style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'linear-gradient(135deg, var(--threshold-accent), #d946ef)',
                fontSize: '1.4rem',
                fontWeight: 800,
                color: 'var(--threshold-text)',
              }}>
                {initials}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                fontSize: '1.15rem',
                fontWeight: 800,
                color: 'var(--threshold-text)',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {name || 'Student'}
              </h2>
              {profile?.reg_number && (
                <p style={{ color: W(0.45), fontSize: '0.78rem', margin: '4px 0 0' }}>
                  {profile.reg_number}
                </p>
              )}
              {profile?.semester && (
                <span style={{
                  display: 'inline-flex',
                  marginTop: '8px',
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: 'var(--threshold-accent-text)',
                }}>
                  Semester {profile.semester}
                </span>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {(profile || academia) && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{
            borderRadius: '18px',
            background: WB(0.02),
            border: `1px solid ${WB(0.06)}`,
            padding: '6px 16px',
          }}
        >
          <InfoRow label="Register No." value={profile?.reg_number || academia?.regNumber} />
          <InfoRow label="Student ID" value={profile?.student_id} />
          <InfoRow label="Email" value={profile?.email} />
          <InfoRow label="Institution" value={profile?.institution} />
          <InfoRow label="Program" value={profile?.program || academia?.program} />
          <InfoRow label="Department" value={academia?.department} />
          <InfoRow label="Semester" value={profile?.semester ?? academia?.semester} />
          <InfoRow label="Batch" value={academia?.batch || profile?.batch} />
          <InfoRow label="Section" value={academia?.section || profile?.section} />
          <InfoRow label="Year" value={academia?.year} />
          <InfoRow label="Faculty Advisor" value={profile?.faculty_advisor} />
          <InfoRow label="Academic Advisor" value={profile?.academic_advisor} />
          <InfoRow label="Mobile" value={academia?.mobile} />
        </motion.div>
      )}

      {personal?.sections && personal.sections.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h2 style={{
            fontSize: '1.05rem',
            fontWeight: 800,
            color: 'var(--threshold-text)',
            margin: '22px 0 10px',
          }}>
            Additional Personal Details
          </h2>
          {personal.sections.map((section, si) => {
            const fields = section.fields.filter((f) => f.value && f.value.trim());
            if (fields.length === 0) return null;
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + si * 0.05 }}
                style={{
                  borderRadius: '18px',
                  background: WB(0.02),
                  border: `1px solid ${WB(0.06)}`,
                  padding: '6px 16px',
                  marginBottom: '12px',
                }}
              >
                <p style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: 'var(--threshold-accent-text)',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  paddingTop: '12px',
                }}>
                  {section.title}
                </p>
                {fields.map((f) => (
                  <InfoRow key={f.label} label={f.label} value={f.value} />
                ))}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <p style={{
        color: W(0.25),
        fontSize: '0.72rem',
        textAlign: 'center',
        marginTop: '20px',
      }}>
        {isAcademiaLoggedIn()
          ? 'Linked to academia — pull down to refresh.'
          : 'Log into academia (timetable) to unlock batch, section and department.'}
      </p>

      <p style={{
        textAlign: 'center',
        fontSize: '0.72rem',
        color: 'var(--threshold-text-faint)',
        margin: '24px 0 8px',
        letterSpacing: '0.3px',
      }}>
        Made by <span style={{ fontWeight: 700, color: 'var(--threshold-text-dim)' }}>Shlok Sathwara</span> ✦
      </p>
    </div>
  );
}