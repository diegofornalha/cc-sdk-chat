import React, { useState } from 'react';
import { ConversationHistory } from './ConversationHistory';
import { ConversationMetrics } from './ConversationMetrics';
import { History, BarChart3, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface HistoryPanelProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onMessageReplay?: (content: string) => void;
}

export function HistoryPanel({ sessionId, isOpen, onClose, onMessageReplay }: HistoryPanelProps) {
  const [activeTab, setActiveTab] = useState('history');

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Histórico & Métricas</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="hover:bg-gray-200"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 p-1">
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="flex-1 overflow-hidden mt-0">
          <ConversationHistory
            sessionId={sessionId}
            onMessageClick={(msg) => {
              if (msg.role === 'user' && onMessageReplay) {
                onMessageReplay(msg.content);
              }
            }}
            className="h-full"
          />
        </TabsContent>

        <TabsContent value="metrics" className="flex-1 overflow-hidden mt-0">
          <ConversationMetrics sessionId={sessionId} className="h-full" />
        </TabsContent>
      </Tabs>
    </div>
  );
}