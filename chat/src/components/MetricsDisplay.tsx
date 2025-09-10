import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Timer, TrendingUp, Activity, RefreshCw } from 'lucide-react';
import { enhancedAPI } from '@/lib/api-enhanced';

interface MetricsSummary {
  operations: Record<string, {
    count: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    total: number;
  }>;
  counters: Record<string, number>;
  active_timers: number;
  timestamp: string;
}

export default function MetricsDisplay() {
  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await enhancedAPI.getMetricsSummary();
      setMetrics(data);
    } catch (error) {
      console.error('Erro ao buscar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  if (!metrics) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 animate-pulse" />
          <span>Carregando métricas...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Métricas de Performance</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto' : 'Manual'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchMetrics}
            disabled={loading}
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Contadores */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Contadores
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(metrics.counters).map(([key, value]) => (
            <div key={key} className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground capitalize">
                {key.replace(/_/g, ' ')}
              </div>
              <div className="text-2xl font-bold">{value}</div>
            </div>
          ))}
          {Object.keys(metrics.counters).length === 0 && (
            <div className="col-span-full text-center text-muted-foreground">
              Nenhum contador registrado
            </div>
          )}
        </div>
      </Card>

      {/* Operações */}
      <Card className="p-4">
        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
          <Timer className="h-4 w-4" />
          Tempos de Operação
        </h4>
        <div className="space-y-3">
          {Object.entries(metrics.operations).map(([operation, stats]) => (
            <div key={operation} className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium capitalize">
                  {operation.replace(/_/g, ' ')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {stats.count} execuções
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Média: </span>
                  <span className="font-mono">{formatDuration(stats.mean)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mediana: </span>
                  <span className="font-mono">{formatDuration(stats.median)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Mín: </span>
                  <span className="font-mono">{formatDuration(stats.min)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Máx: </span>
                  <span className="font-mono">{formatDuration(stats.max)}</span>
                </div>
              </div>
            </div>
          ))}
          {Object.keys(metrics.operations).length === 0 && (
            <div className="text-center text-muted-foreground py-4">
              Nenhuma operação registrada
            </div>
          )}
        </div>
      </Card>

      {/* Status */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Timers ativos: {metrics.active_timers}</span>
        <span>
          Última atualização: {new Date(metrics.timestamp).toLocaleTimeString('pt-BR')}
        </span>
      </div>
    </div>
  );
}