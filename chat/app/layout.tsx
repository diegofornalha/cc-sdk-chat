import React from 'react';
import '../globals.css';
import { Providers } from '../providers';

export const metadata = {
  title: 'Markdown Parser',
  description: 'Um parser de markdown com streaming',
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