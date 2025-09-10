#!/usr/bin/env python3
"""
Sistema de métricas e performance
Centraliza coleta e análise de métricas de uso
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
import time
from collections import defaultdict
import statistics

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

# Armazenamento em memória (simples para começar)
class MetricsStore:
    def __init__(self):
        self.timers = {}  # Timers ativos
        self.durations = defaultdict(list)  # Durações por operação
        self.counters = defaultdict(int)  # Contadores gerais
        
    def start_timer(self, operation: str, session_id: str) -> str:
        """Inicia um timer para uma operação"""
        timer_id = f"{operation}_{session_id}_{int(time.time() * 1000)}"
        self.timers[timer_id] = {
            "start": time.time(),
            "operation": operation,
            "session_id": session_id
        }
        return timer_id
    
    def end_timer(self, timer_id: str) -> float:
        """Finaliza um timer e retorna duração em ms"""
        if timer_id not in self.timers:
            return 0
        
        timer = self.timers.pop(timer_id)
        duration = (time.time() - timer["start"]) * 1000  # em ms
        
        # Armazenar duração
        key = f"{timer['operation']}_{timer['session_id']}"
        self.durations[key].append(duration)
        
        return duration
    
    def increment(self, metric: str, value: int = 1):
        """Incrementa um contador"""
        self.counters[metric] += value
    
    def get_stats(self, operation: str, session_id: Optional[str] = None) -> Dict:
        """Obtém estatísticas para uma operação"""
        key = f"{operation}_{session_id}" if session_id else operation
        values = []
        
        # Coletar todas as durações relevantes
        for k, v in self.durations.items():
            if key in k or (not session_id and operation in k):
                values.extend(v)
        
        if not values:
            return {
                "count": 0,
                "mean": 0,
                "median": 0,
                "min": 0,
                "max": 0,
                "total": 0
            }
        
        return {
            "count": len(values),
            "mean": statistics.mean(values),
            "median": statistics.median(values),
            "min": min(values),
            "max": max(values),
            "total": sum(values)
        }

# Instância global
metrics = MetricsStore()

class StartTimerRequest(BaseModel):
    operation: str
    session_id: Optional[str] = "global"

class TimerResponse(BaseModel):
    timer_id: str
    operation: str
    session_id: str

class EndTimerRequest(BaseModel):
    timer_id: str

class DurationResponse(BaseModel):
    duration_ms: float
    operation: str

class IncrementRequest(BaseModel):
    metric: str
    value: int = 1

class StatsResponse(BaseModel):
    operation: str
    stats: Dict
    timestamp: datetime

@router.post("/timer/start", response_model=TimerResponse)
async def start_timer(request: StartTimerRequest):
    """Inicia timer para medir duração de operação"""
    timer_id = metrics.start_timer(request.operation, request.session_id or "global")
    
    return TimerResponse(
        timer_id=timer_id,
        operation=request.operation,
        session_id=request.session_id or "global"
    )

@router.post("/timer/end", response_model=DurationResponse)
async def end_timer(request: EndTimerRequest):
    """Finaliza timer e retorna duração"""
    duration = metrics.end_timer(request.timer_id)
    
    if duration == 0:
        raise HTTPException(status_code=404, detail="Timer não encontrado")
    
    # Extrair operação do timer_id
    parts = request.timer_id.split("_")
    operation = parts[0] if parts else "unknown"
    
    return DurationResponse(
        duration_ms=duration,
        operation=operation
    )

@router.post("/increment")
async def increment_metric(request: IncrementRequest):
    """Incrementa um contador de métrica"""
    metrics.increment(request.metric, request.value)
    
    return {
        "metric": request.metric,
        "new_value": metrics.counters[request.metric]
    }

@router.get("/stats/{operation}", response_model=StatsResponse)
async def get_operation_stats(operation: str, session_id: Optional[str] = None):
    """Obtém estatísticas de uma operação"""
    stats = metrics.get_stats(operation, session_id)
    
    return StatsResponse(
        operation=operation,
        stats=stats,
        timestamp=datetime.utcnow()
    )

@router.get("/summary")
async def get_metrics_summary():
    """Obtém resumo geral de métricas"""
    
    # Calcular estatísticas gerais
    all_operations = set()
    for key in metrics.durations.keys():
        operation = key.split("_")[0]
        all_operations.add(operation)
    
    summary = {
        "operations": {},
        "counters": dict(metrics.counters),
        "active_timers": len(metrics.timers),
        "timestamp": datetime.utcnow()
    }
    
    for op in all_operations:
        summary["operations"][op] = metrics.get_stats(op)
    
    return summary

@router.post("/reset")
async def reset_metrics():
    """Reseta todas as métricas (apenas para desenvolvimento)"""
    metrics.timers.clear()
    metrics.durations.clear()
    metrics.counters.clear()
    
    return {"message": "Métricas resetadas", "timestamp": datetime.utcnow()}

@router.get("/health")
async def metrics_health():
    """Health check do sistema de métricas"""
    return {
        "status": "healthy",
        "active_timers": len(metrics.timers),
        "tracked_operations": len(metrics.durations),
        "total_counters": len(metrics.counters),
        "timestamp": datetime.utcnow()
    }