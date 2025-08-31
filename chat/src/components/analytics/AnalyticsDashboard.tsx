import React from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  MessageSquare,
  Zap,
  Clock,
  Calendar
} from 'lucide-react'
import { format, subDays, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import useChatStore from '@/stores/chatStore'

export function AnalyticsDashboard() {
  const { sessions } = useChatStore()
  
  // Calcular métricas
  const calculateMetrics = () => {
    const allSessions = Array.from(sessions.values())
    
    const totalMessages = allSessions.reduce((acc, s) => acc + s.messages.length, 0)
    const totalTokens = allSessions.reduce((acc, s) => acc + s.metrics.totalTokens, 0)
    const totalCost = allSessions.reduce((acc, s) => acc + s.metrics.totalCost, 0)
    const activeSessions = allSessions.length
    
    // Tokens por dia (últimos 7 dias)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = startOfDay(subDays(new Date(), 6 - i))
      const dayData = allSessions.reduce((acc, session) => {
        const dayMessages = session.messages.filter(m => {
          const msgDate = startOfDay(new Date(m.timestamp))
          return msgDate.getTime() === date.getTime()
        })
        
        const tokens = dayMessages.reduce((t, m) => {
          return t + (m.tokens?.input || 0) + (m.tokens?.output || 0)
        }, 0)
        
        const cost = dayMessages.reduce((c, m) => c + (m.cost || 0), 0)
        
        return { tokens: acc.tokens + tokens, cost: acc.cost + cost }
      }, { tokens: 0, cost: 0 })
      
      return {
        date: format(date, 'dd/MM', { locale: ptBR }),
        tokens: dayData.tokens,
        cost: dayData.cost
      }
    })
    
    // Ferramentas mais usadas
    const toolUsage = allSessions.reduce((acc, session) => {
      session.messages.forEach(msg => {
        if (msg.tools) {
          msg.tools.forEach(tool => {
            acc[tool] = (acc[tool] || 0) + 1
          })
        }
      })
      return acc
    }, {} as Record<string, number>)
    
    const toolData = Object.entries(toolUsage).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / Object.values(toolUsage).reduce((a, b) => a + b, 0)) * 100)
    }))
    
    // Distribuição por tipo de mensagem
    const messageTypes = allSessions.reduce((acc, session) => {
      session.messages.forEach(msg => {
        acc[msg.role] = (acc[msg.role] || 0) + 1
      })
      return acc
    }, {} as Record<string, number>)
    
    return {
      totalMessages,
      totalTokens,
      totalCost,
      activeSessions,
      last7Days,
      toolData,
      messageTypes
    }
  }
  
  const metrics = calculateMetrics()
  
  // Cores para gráficos
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
  
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Analytics Dashboard</h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Últimos 7 dias
        </div>
      </div>

      {/* Métricas principais */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Mensagens
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeSessions} sessões ativas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tokens Utilizados
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.totalTokens.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">
              Média: {Math.round(metrics.totalTokens / Math.max(metrics.totalMessages, 1))} por mensagem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Custo Total
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${metrics.totalCost.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(metrics.totalCost / Math.max(metrics.totalMessages, 1)).toFixed(6)} por mensagem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tempo Médio
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2.3s</div>
            <p className="text-xs text-muted-foreground">
              Por resposta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Uso ao Longo do Tempo</TabsTrigger>
          <TabsTrigger value="tools">Ferramentas</TabsTrigger>
          <TabsTrigger value="distribution">Distribuição</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tokens por Dia</CardTitle>
              <CardDescription>
                Consumo de tokens nos últimos 7 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={metrics.last7Days}>
                  <defs>
                    <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="tokens" 
                    stroke="#3b82f6" 
                    fillOpacity={1} 
                    fill="url(#colorTokens)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Custo por Dia</CardTitle>
              <CardDescription>
                Gastos em USD nos últimos 7 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.last7Days}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: number) => `$${value.toFixed(4)}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cost" 
                    stroke="#10b981" 
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ferramentas Mais Usadas</CardTitle>
              <CardDescription>
                Distribuição de uso de ferramentas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.toolData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={metrics.toolData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                  Nenhuma ferramenta utilizada ainda
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Mensagens</CardTitle>
              <CardDescription>
                Proporção de mensagens por tipo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={Object.entries(metrics.messageTypes).map(([key, value]) => ({
                      name: key === 'user' ? 'Usuário' : 'Assistente',
                      value
                    }))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {Object.entries(metrics.messageTypes).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}