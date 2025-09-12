#!/usr/bin/env python3
"""
Endpoints de Health Check para o Monitor de Sessões
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from typing import Dict, Any
import logging

from ..core.monitor_manager import get_monitor_manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/monitor", tags=["monitor"])

@router.get("/health")
async def get_health_status() -> Dict[str, Any]:
    """
    Retorna o status de saúde do monitor de sessões
    
    Returns:
        Status detalhado incluindo:
        - status: healthy | degraded | error | stopped
        - uptime: tempo em segundos desde o início
        - files_monitored: número de arquivos sendo monitorados
        - bytes_processed: total de bytes processados
        - last_activity: timestamp da última atividade
        - errors: lista dos últimos erros
    """
    try:
        manager = get_monitor_manager()
        status = manager.get_health_status()
        
        # Adiciona recomendações baseadas no status
        if status["status"] == "stopped":
            status["recommendation"] = "Monitor está parado. Use POST /api/monitor/start para iniciar"
        elif status["status"] == "error":
            status["recommendation"] = "Monitor com erros. Verifique os logs ou use POST /api/monitor/restart"
        elif status["status"] == "degraded":
            status["recommendation"] = "Monitor em estado degradado. Considere reiniciar"
        elif status["restarts"] > 3:
            status["recommendation"] = f"Monitor reiniciou {status['restarts']} vezes. Verifique estabilidade"
        
        return status
        
    except Exception as e:
        logger.error(f"Erro ao obter status de saúde: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start")
async def start_monitor() -> Dict[str, Any]:
    """
    Inicia o monitor de sessões
    
    Returns:
        Status da operação
    """
    try:
        manager = get_monitor_manager()
        success = await manager.start()
        
        if success:
            return {
                "status": "success",
                "message": "Monitor iniciado com sucesso"
            }
        else:
            return {
                "status": "error",
                "message": "Monitor já está em execução ou falha ao iniciar"
            }
            
    except Exception as e:
        logger.error(f"Erro ao iniciar monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/stop")
async def stop_monitor() -> Dict[str, Any]:
    """
    Para o monitor de sessões
    
    Returns:
        Status da operação
    """
    try:
        manager = get_monitor_manager()
        success = await manager.stop()
        
        if success:
            return {
                "status": "success",
                "message": "Monitor parado com sucesso"
            }
        else:
            return {
                "status": "error",
                "message": "Falha ao parar monitor"
            }
            
    except Exception as e:
        logger.error(f"Erro ao parar monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restart")
async def restart_monitor() -> Dict[str, Any]:
    """
    Reinicia o monitor de sessões
    
    Returns:
        Status da operação
    """
    try:
        manager = get_monitor_manager()
        success = await manager.restart()
        
        if success:
            return {
                "status": "success",
                "message": "Monitor reiniciado com sucesso"
            }
        else:
            return {
                "status": "error",
                "message": "Falha ao reiniciar monitor. Verifique logs"
            }
            
    except Exception as e:
        logger.error(f"Erro ao reiniciar monitor: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_monitor_stats() -> Dict[str, Any]:
    """
    Retorna estatísticas detalhadas do monitor
    
    Returns:
        Estatísticas incluindo arquivos monitorados, bytes processados, etc
    """
    try:
        manager = get_monitor_manager()
        
        # Verifica se o monitor está rodando
        if not manager.is_running or not manager.monitor:
            return {
                "status": "stopped",
                "message": "Monitor não está em execução"
            }
        
        # Obtém estatísticas do monitor
        stats = manager.monitor.get_stats()
        
        # Adiciona informações do manager
        health = manager.get_health_status()
        stats["uptime"] = health.get("uptime", 0)
        stats["status"] = health.get("status", "unknown")
        stats["restarts"] = health.get("restarts", 0)
        
        return stats
        
    except Exception as e:
        logger.error(f"Erro ao obter estatísticas: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/logs")
async def get_monitor_logs(limit: int = 50) -> Dict[str, Any]:
    """
    Retorna os últimos logs/erros do monitor
    
    Args:
        limit: Número máximo de entradas a retornar (padrão: 50)
    
    Returns:
        Lista dos últimos erros e eventos
    """
    try:
        manager = get_monitor_manager()
        health = manager.get_health_status()
        
        errors = health.get("errors", [])
        
        # Limita o número de erros retornados
        if len(errors) > limit:
            errors = errors[-limit:]
        
        return {
            "total_errors": len(health.get("errors", [])),
            "returned": len(errors),
            "errors": errors,
            "last_check": health.get("last_check"),
            "status": health.get("status")
        }
        
    except Exception as e:
        logger.error(f"Erro ao obter logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))