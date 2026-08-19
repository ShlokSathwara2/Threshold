"use client";

import { useEffect } from 'react';
import { isNativePlatform } from '@/lib/capacitor';

export default function PwaBootstrap() {
  useEffect(() => {
    if (isNativePlatform()) return;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}