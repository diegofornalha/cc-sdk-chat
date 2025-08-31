# Dockerfile otimizado para API Python com Claude SDK
FROM python:3.11-slim

# Metadados da imagem
LABEL maintainer="Claude API Team <api@example.com>" \
      version="1.0.0" \
      description="Claude Code SDK API - Otimizada e Segura"

# Atualiza pip para versão mais recente
RUN pip install --no-cache-dir --upgrade pip setuptools wheel

# Instala dependências essenciais do sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Cria usuário não-root para segurança
RUN groupadd --gid 1001 claude && \
    useradd --uid 1001 --gid claude --shell /bin/bash --create-home claude

# Define diretórios de trabalho
WORKDIR /app

# Cria diretórios para sessões e dados com permissões corretas
RUN mkdir -p /app/sessions /app/data /app/logs && \
    chown -R claude:claude /app

# Copia requirements primeiro para otimizar cache do Docker
COPY requirements.txt ./

# Instala dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia o SDK do Claude com permissões corretas
COPY --chown=claude:claude claude-code-sdk-python /app/claude-code-sdk-python

# Copia código da aplicação
COPY --chown=claude:claude *.py ./

# Muda para usuário não-root
USER claude

# Configura variáveis de ambiente
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/app:/app/claude-code-sdk-python" \
    PORT=8989 \
    HOST=0.0.0.0 \
    SESSIONS_DIR=/app/sessions \
    DATA_DIR=/app/data \
    LOG_LEVEL=INFO

# Expõe porta
EXPOSE 8989

# Volumes para persistência de dados
VOLUME ["/app/sessions", "/app/data", "/app/logs"]

# Healthcheck otimizado - verifica tanto o endpoint quanto a saúde da aplicação
HEALTHCHECK --interval=30s --timeout=15s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8989/ --max-time 10 || exit 1

# Comando para iniciar aplicação com configurações otimizadas
CMD ["python3", "-u", "server.py"]