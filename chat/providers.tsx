'use client';

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { ReactNode } from 'react';
import { GlobalErrorBoundary } from '@/components/error/GlobalErrorBoundary';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <Toaster 
          position="top-right" 
          richColors
          closeButton
          expand={false}
        />
        {children}
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
} 