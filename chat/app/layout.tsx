import React from 'react';
import '@/styles/globals.css';
import { Providers } from '../providers';

export const metadata = {
  title: 'Claude Chat - Interface Avançada',
  description: 'Chat profissional com Claude usando SDK Python',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
} 