#!/usr/bin/env python3
"""
Sistema de logging centralizado
Remove necessidade de salvar logs no localStorage do browser
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from enum import Enum
import json
import logging
from pathlib import Path
import asyncio
from collections import deque

router = APIRouter(prefix="/api/logs", tags=["logging"])

# Configurar logging
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Configurar logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_dir / "app.log"),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger("claude_chat")

# Buffer de logs em memória (últimos 1000 logs)
log_buffer = deque(maxlen=1000)

class LogLevel(str, Enum):
    """Níveis de log"""
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

class LogEntry(BaseModel):
    """Modelo de entrada de log"""
    level: LogLevel
    message: str
    component: str = Field(..., description="Componente que gerou o log")
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Optional[Dict] = Field(default_factory=dict)
    timestamp: Optional[datetime] = None
    
class LogFilter(BaseModel):
    """Filtros para buscar logs"""
    level: Optional[LogLevel] = None
    component: Optional[str] = None
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    limit: int = Field(100, le=1000)

class LogStats(BaseModel):
    """Estatísticas de logs"""
    total_logs: int
    by_level: Dict[str, int]
    by_component: Dict[str, int]
    recent_errors: List[dict]
    time_range: dict

# Funções auxiliares
def format_log_entry(entry: LogEntry) -> dict:
    """Formata entrada de log"""
    return {
        "timestamp": entry.timestamp or datetime.utcnow(),
        "level": entry.level.value,
        "component": entry.component,
        "message": entry.message,
        "session_id": entry.session_id,
        "user_id": entry.user_id,
        "metadata": entry.metadata
    }

async def write_to_file(log_data: dict):
    """Escreve log em arquivo de forma assíncrona"""
    log_file = log_dir / f"app_{datetime.now().strftime('%Y%m%d')}.log"
    
    def write():
        with open(log_file, "a") as f:
            f.write(json.dumps(log_data, default=str) + "\n")
    
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, write)

# Rotas
@router.post("/write")
async def write_log(entry: LogEntry):
    """
    Escreve log no servidor
    Substitui localStorage do frontend
    """
    log_data = format_log_entry(entry)
    
    # Adicionar ao buffer
    log_buffer.append(log_data)
    
    # Logar usando Python logger
    level = getattr(logging, entry.level.value.upper())
    logger.log(
        level,
        f"[{entry.component}] {entry.message}",
        extra={
            "session_id": entry.session_id,
            "user_id": entry.user_id,
            "metadata": entry.metadata
        }
    )
    
    # Escrever em arquivo
    await write_to_file(log_data)
    
    return {"status": "success", "timestamp": log_data["timestamp"]}

@router.post("/batch")
async def write_batch_logs(entries: List[LogEntry]):
    """
    Escreve múltiplos logs de uma vez
    Útil para enviar logs acumulados do frontend
    """
    results = []
    
    for entry in entries:
        log_data = format_log_entry(entry)
        log_buffer.append(log_data)
        await write_to_file(log_data)
        results.append(log_data["timestamp"])
    
    return {
        "status": "success",
        "count": len(entries),
        "timestamps": results
    }

@router.post("/search")
async def search_logs(filters: LogFilter):
    """
    Busca logs com filtros
    Retorna logs do buffer de memória
    """
    results = []
    
    for log in log_buffer:
        # Aplicar filtros
        if filters.level and log["level"] != filters.level.value:
            continue
        if filters.component and log["component"] != filters.component:
            continue
        if filters.session_id and log["session_id"] != filters.session_id:
            continue
        if filters.user_id and log["user_id"] != filters.user_id:
            continue
        if filters.start_time and log["timestamp"] < filters.start_time:
            continue
        if filters.end_time and log["timestamp"] > filters.end_time:
            continue
        
        results.append(log)
        
        if len(results) >= filters.limit:
            break
    
    return {
        "total": len(results),
        "logs": results
    }

@router.get("/recent")
async def get_recent_logs(
    limit: int = Query(50, le=100),
    level: Optional[LogLevel] = None
):
    """
    Retorna logs mais recentes
    """
    logs = list(log_buffer)[-limit:]
    
    if level:
        logs = [log for log in logs if log["level"] == level.value]
    
    return {
        "total": len(logs),
        "logs": logs
    }

@router.get("/stats")
async def get_log_stats(
    hours: int = Query(24, description="Horas para análise")
):
    """
    Retorna estatísticas de logs
    """
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)
    
    by_level = {}
    by_component = {}
    recent_errors = []
    total = 0
    
    for log in log_buffer:
        if log["timestamp"] < cutoff_time:
            continue
        
        total += 1
        
        # Contar por nível
        level = log["level"]
        by_level[level] = by_level.get(level, 0) + 1
        
        # Contar por componente
        component = log["component"]
        by_component[component] = by_component.get(component, 0) + 1
        
        # Coletar erros recentes
        if log["level"] in ["error", "critical"] and len(recent_errors) < 10:
            recent_errors.append({
                "timestamp": log["timestamp"],
                "component": log["component"],
                "message": log["message"],
                "session_id": log.get("session_id")
            })
    
    return LogStats(
        total_logs=total,
        by_level=by_level,
        by_component=by_component,
        recent_errors=recent_errors,
        time_range={
            "start": cutoff_time,
            "end": datetime.utcnow(),
            "hours": hours
        }
    )

@router.delete("/clear")
async def clear_logs(
    session_id: Optional[str] = None,
    component: Optional[str] = None
):
    """
    Limpa logs do buffer
    Pode filtrar por sessão ou componente
    """
    global log_buffer
    
    if not session_id and not component:
        # Limpar tudo
        log_buffer.clear()
        return {"status": "success", "message": "Todos os logs foram limpos"}
    
    # Filtrar logs a manter
    new_buffer = deque(maxlen=1000)
    removed = 0
    
    for log in log_buffer:
        keep = True
        
        if session_id and log.get("session_id") == session_id:
            keep = False
        if component and log.get("component") == component:
            keep = False
        
        if keep:
            new_buffer.append(log)
        else:
            removed += 1
    
    log_buffer = new_buffer
    
    return {
        "status": "success",
        "removed": removed,
        "remaining": len(log_buffer)
    }

@router.get("/export")
async def export_logs(
    format: str = Query("json", regex="^(json|csv|txt)$"),
    session_id: Optional[str] = None
):
    """
    Exporta logs em diferentes formatos
    """
    logs = list(log_buffer)
    
    if session_id:
        logs = [log for log in logs if log.get("session_id") == session_id]
    
    if format == "json":
        return {
            "export_date": datetime.utcnow(),
            "total": len(logs),
            "logs": logs
        }
    
    elif format == "csv":
        import csv
        import io
        
        output = io.StringIO()
        writer = csv.DictWriter(
            output,
            fieldnames=["timestamp", "level", "component", "message", "session_id", "user_id"]
        )
        writer.writeheader()
        
        for log in logs:
            writer.writerow({
                "timestamp": log["timestamp"],
                "level": log["level"],
                "component": log["component"],
                "message": log["message"],
                "session_id": log.get("session_id", ""),
                "user_id": log.get("user_id", "")
            })
        
        from fastapi.responses import Response
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=logs.csv"}
        )
    
    elif format == "txt":
        lines = []
        for log in logs:
            line = f"[{log['timestamp']}] [{log['level'].upper()}] [{log['component']}] {log['message']}"
            if log.get("session_id"):
                line += f" (session: {log['session_id']})"
            lines.append(line)
        
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse("\n".join(lines))

# Endpoint de healthcheck
@router.get("/health")
async def log_health():
    """
    Verifica saúde do sistema de logging
    """
    return {
        "status": "healthy",
        "buffer_size": len(log_buffer),
        "buffer_capacity": log_buffer.maxlen,
        "log_directory": str(log_dir),
        "log_files": len(list(log_dir.glob("*.log")))
    }