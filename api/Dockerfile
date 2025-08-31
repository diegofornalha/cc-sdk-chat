# 🚀 Claude Code API Docker - Configuração Completa
FROM python:3.11-slim

LABEL maintainer="CC-SDK-Chat API"
LABEL version="1.0.0" 
LABEL description="FastAPI com Claude Code SDK integrado"

# Define diretório de trabalho
WORKDIR /app

# Instala dependências do sistema e Node.js para Claude Code CLI
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    git \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @anthropic-ai/claude-code \
    && rm -rf /var/lib/apt/lists/*

# Copia arquivos de requisitos primeiro (para cache do Docker)
COPY requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia código da aplicação  
COPY . .

# Criar script de bypass Claude Code
RUN echo '#!/bin/bash' > /usr/local/bin/claude-bypass && \
    echo 'export CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=true' >> /usr/local/bin/claude-bypass && \
    echo 'export CLAUDE_AUTO_APPROVE_MCP=true' >> /usr/local/bin/claude-bypass && \
    echo 'export CLAUDE_TRUST_ALL_DIRECTORIES=true' >> /usr/local/bin/claude-bypass && \
    echo 'export CLAUDE_DISABLE_TELEMETRY=1' >> /usr/local/bin/claude-bypass && \
    echo 'export CLAUDE_BYPASS_PERMISSIONS=true' >> /usr/local/bin/claude-bypass && \
    echo 'export CLAUDE_NO_PROMPT=true' >> /usr/local/bin/claude-bypass && \
    echo 'export CLAUDE_AUTO_APPROVE=true' >> /usr/local/bin/claude-bypass && \
    echo 'exec claude --dangerously-skip-permissions "$@"' >> /usr/local/bin/claude-bypass && \
    chmod +x /usr/local/bin/claude-bypass

# Criar claude-safe como link
RUN ln -sf /usr/local/bin/claude-bypass /usr/local/bin/claude-safe

# Cria usuário não-root com mesmo UID (1002 para compatibilidade)
RUN useradd -m -u 1002 -s /bin/bash appuser && \
    chown -R appuser:appuser /app

# Configurar para o usuário appuser
USER appuser

# Criar diretório .claude para o appuser
RUN mkdir -p /home/appuser/.claude

# Criar settings.local.json permissivo para Claude Code
RUN echo '{"permissions":{"allow":["*"],"deny":[],"ask":[]},"trustWorkspace":true,"autoApprove":true,"dangerouslySkipPermissions":true}' > /home/appuser/.claude/settings.local.json

# Adicionar configurações ao bashrc do appuser
RUN echo '# Claude Code Bypass Configuration' >> /home/appuser/.bashrc && \
    echo 'export CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=true' >> /home/appuser/.bashrc && \
    echo 'export CLAUDE_AUTO_APPROVE=true' >> /home/appuser/.bashrc && \
    echo 'export CLAUDE_TRUST_ALL_DIRECTORIES=true' >> /home/appuser/.bashrc && \
    echo 'export CLAUDE_AUTO_APPROVE_MCP=true' >> /home/appuser/.bashrc && \
    echo 'export CLAUDE_BYPASS_PERMISSIONS=true' >> /home/appuser/.bashrc && \
    echo 'export CLAUDE_NO_PROMPT=true' >> /home/appuser/.bashrc && \
    echo 'export CLAUDE_DISABLE_TELEMETRY=1' >> /home/appuser/.bashrc && \
    echo 'alias claude="/usr/local/bin/claude-bypass"' >> /home/appuser/.bashrc && \
    echo 'alias claude-safe="/usr/local/bin/claude-bypass"' >> /home/appuser/.bashrc && \
    echo 'alias cs="claude-safe"' >> /home/appuser/.bashrc

# Configurar variáveis de ambiente permanentes
ENV CLAUDE_DANGEROUSLY_SKIP_PERMISSIONS=true
ENV CLAUDE_AUTO_APPROVE=true
ENV CLAUDE_TRUST_ALL_DIRECTORIES=true
ENV CLAUDE_AUTO_APPROVE_MCP=true
ENV CLAUDE_BYPASS_PERMISSIONS=true
ENV CLAUDE_NO_PROMPT=true
ENV CLAUDE_DISABLE_TELEMETRY=1

# Variáveis da aplicação
ENV PYTHONUNBUFFERED=1
ENV LOG_LEVEL=INFO
ENV PORT=8990

# Expõe porta da API
EXPOSE 8990

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8990/ || exit 1

# Comando para iniciar a aplicação
CMD ["python3", "-u", "server.py"]