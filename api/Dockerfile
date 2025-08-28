# Dockerfile para API Python com Claude SDK
FROM python:3.11-slim

# Define diretório de trabalho
WORKDIR /app

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copia arquivos de requisitos primeiro (para cache do Docker)
COPY requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia o SDK do Claude
COPY claude-code-sdk-python /app/claude-code-sdk-python

# Copia código da aplicação
COPY . .

# Expõe porta
EXPOSE 8989

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8989/ || exit 1

# Comando para iniciar a aplicação
CMD ["python3", "-u", "server.py"]