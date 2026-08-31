"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { getCursorStyle } from '@/lib/cursor-effects';

const CustomCursor = dynamic(() => import('@/components/ui/CustomCursor'), { ssr: false });

export default function CursorProvider({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const check = () => setShow(getCursorStyle() !== 'off');
    check();
    const iv = setInterval(check, 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      {show && <CustomCursor />}
      {children}
    </>
  );
}
