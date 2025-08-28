'use client';

import React from 'react';
import { ChatInterface } from '../components/ChatInterface';

export default function Home(): JSX.Element {
    return (
        <main className="main-container">
            <ChatInterface />
            <style jsx>{`
                .main-container {
                    width: 100%;
                    height: 100vh;
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
            `}</style>
        </main>
    );
}