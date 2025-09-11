import React, { useState, useEffect } from 'react';
import { Clock, MessageSquare, User, Bot, Search, Download, Trash2, Save } from 'lucide-react';
import { format } from 'date-fns';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: any;
}

interface ConversationHistoryProps {
  sessionId: string;
  onMessageClick?: (message: Message) => void;
  className?: string;
}

export function ConversationHistory({ sessionId, onMessageClick, className = '' }: ConversationHistoryProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);

  useEffect(() => {
    loadHistory();
  }, [sessionId]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = messages.filter(msg => 
        msg.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMessages(filtered);
    } else {
      setFilteredMessages(messages);
    }
  }, [searchTerm, messages]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const { config } = await import('@/lib/config');
      const apiUrl = config.getApiUrl();
      const response = await fetch(`${apiUrl}/api/history/session/${sessionId}?limit=100`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveHistory = async () => {
    try {
      const { config } = await import('@/lib/config');
      const apiUrl = config.getApiUrl();
      await fetch(`${apiUrl}/api/history/session/${sessionId}/save`, { method: 'POST' });
      alert('Histórico salvo com sucesso!');
    } catch (error) {
      console.error('Failed to save history:', error);
      alert('Erro ao salvar histórico');
    }
  };

  const clearHistory = async () => {
    if (!confirm('Tem certeza que deseja limpar o histórico desta sessão?')) return;
    
    try {
      const { config } = await import('@/lib/config');
      const apiUrl = config.getApiUrl();
      await fetch(`${apiUrl}/api/history/session/${sessionId}`, { method: 'DELETE' });
      setMessages([]);
      alert('Histórico limpo com sucesso!');
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert('Erro ao limpar histórico');
    }
  };

  const exportHistory = () => {
    const dataStr = JSON.stringify(messages, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `conversation_${sessionId}_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="w-4 h-4" />;
      case 'assistant':
        return <Bot className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'user':
        return 'bg-blue-50 border-blue-200';
      case 'assistant':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900">Histórico da Conversação</h3>
          <span className="text-sm text-gray-500">({messages.length} mensagens)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={saveHistory}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Salvar histórico"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            onClick={exportHistory}
            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Exportar histórico"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={clearHistory}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Limpar histórico"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar no histórico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {searchTerm ? 'Nenhuma mensagem encontrada' : 'Nenhuma mensagem no histórico'}
          </div>
        ) : (
          filteredMessages.map((message, index) => (
            <div
              key={index}
              onClick={() => onMessageClick?.(message)}
              className={`p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${getRoleColor(message.role)}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-1">
                  {getRoleIcon(message.role)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-600 capitalize">
                      {message.role}
                    </span>
                    {message.timestamp && (
                      <span className="text-xs text-gray-400">
                        {format(new Date(message.timestamp), 'HH:mm:ss')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 break-words whitespace-pre-wrap line-clamp-3">
                    {message.content}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}