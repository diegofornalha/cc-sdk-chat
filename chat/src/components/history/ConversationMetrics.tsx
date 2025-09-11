import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Clock, DollarSign, MessageSquare, Zap, AlertCircle } from 'lucide-react';
import { Card } from '../ui/card';

interface Metrics {
  total_sessions: number;
  total_messages: number;
  total_tokens: number;
  total_cost_usd: number;
  average_messages_per_session: number;
  success_rate?: number;
  average_duration_seconds?: number;
  requests_per_minute?: number;
}

interface TopicAnalysis {
  topics: Array<{ topic: string; count: number }>;
  total_topics: number;
}

interface ConversationMetricsProps {
  sessionId: string;
  className?: string;
}

export function ConversationMetrics({ sessionId, className = '' }: ConversationMetricsProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [topics, setTopics] = useState<TopicAnalysis | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, [sessionId]);

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Importar configuração
      const { config } = await import('@/lib/config');
      const apiUrl = config.getApiUrl();
      
      // Carregar métricas globais
      const metricsResponse = await fetch(`${apiUrl}/api/history/metrics/global`);
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData);
      }

      // Carregar análise de tópicos
      const topicsResponse = await fetch(`${apiUrl}/api/history/analytics/topics`);
      if (topicsResponse.ok) {
        const topicsData = await topicsResponse.json();
        setTopics(topicsData);
      }
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 text-gray-500 ${className}`}>
        <AlertCircle className="w-12 h-12 mb-2" />
        <p>Não foi possível carregar as métricas</p>
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-4 overflow-y-auto ${className}`}>
      {/* Métricas Principais */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-gray-600">Mensagens</span>
          </div>
          <p className="text-lg font-semibold">{formatNumber(metrics.total_messages)}</p>
          <p className="text-xs text-gray-500">
            ~{Math.round(metrics.average_messages_per_session)} por sessão
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-gray-600">Tokens</span>
          </div>
          <p className="text-lg font-semibold">{formatNumber(metrics.total_tokens)}</p>
          <p className="text-xs text-gray-500">
            ~{Math.round(metrics.total_tokens / Math.max(metrics.total_messages, 1))} por msg
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-green-500" />
            <span className="text-xs text-gray-600">Custo Total</span>
          </div>
          <p className="text-lg font-semibold">{formatCurrency(metrics.total_cost_usd)}</p>
          <p className="text-xs text-gray-500">
            ~{formatCurrency(metrics.total_cost_usd / Math.max(metrics.total_messages, 1))} por msg
          </p>
        </Card>

        <Card className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-gray-600">Sessões</span>
          </div>
          <p className="text-lg font-semibold">{metrics.total_sessions}</p>
          <p className="text-xs text-gray-500">
            {metrics.total_sessions > 0 ? `Ativas agora` : 'Nenhuma ativa'}
          </p>
        </Card>
      </div>

      {/* Taxa de Sucesso e Performance */}
      {(metrics.success_rate !== undefined || metrics.average_duration_seconds !== undefined) && (
        <Card className="p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Performance
          </h3>
          
          {metrics.success_rate !== undefined && (
            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Taxa de Sucesso</span>
                <span className="font-medium">{(metrics.success_rate * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${metrics.success_rate * 100}%` }}
                />
              </div>
            </div>
          )}

          {metrics.average_duration_seconds !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Tempo Médio
              </span>
              <span className="font-medium">
                {metrics.average_duration_seconds.toFixed(2)}s
              </span>
            </div>
          )}

          {metrics.requests_per_minute !== undefined && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-600">Requisições/min</span>
              <span className="font-medium">
                {metrics.requests_per_minute.toFixed(2)}
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Tópicos Mais Discutidos */}
      {topics && topics.topics.length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium text-sm mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Tópicos Populares
          </h3>
          
          <div className="space-y-2">
            {topics.topics.slice(0, 5).map((topic, index) => (
              <div key={topic.topic} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">#{index + 1}</span>
                  <span className="text-sm">{topic.topic}</span>
                </div>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded-full">
                  {topic.count} menções
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Estatísticas Adicionais */}
      <Card className="p-4">
        <h3 className="font-medium text-sm mb-3">Estatísticas Detalhadas</h3>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Custo médio por token</span>
            <span className="font-medium">
              {formatCurrency(metrics.total_cost_usd / Math.max(metrics.total_tokens, 1))}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Tokens por sessão</span>
            <span className="font-medium">
              ~{formatNumber(Math.round(metrics.total_tokens / Math.max(metrics.total_sessions, 1)))}
            </span>
          </div>
          
          <div className="flex justify-between">
            <span className="text-gray-600">Eficiência</span>
            <span className="font-medium">
              {((metrics.total_messages / Math.max(metrics.total_tokens, 1)) * 1000).toFixed(2)} msgs/1k tokens
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}