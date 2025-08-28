'use client';

import React, { useState } from 'react';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { PasswordModal } from '@/components/auth/PasswordModal';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <>
      {!isAuthenticated && (
        <PasswordModal onSuccess={() => setIsAuthenticated(true)} />
      )}
      <ChatInterface />
    </>
  );
}