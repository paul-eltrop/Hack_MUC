# Agent-Service: 5-min cron loop — Manex Postgres + Qdrant + Claude Sonnet 4.6.
# Context is the repo root so we can also copy agent/ (verify.py import) and rag/.
# Runtime paths: AGENT_STATE_PATH + QDRANT_PATH + MANEX_DB_URL are set via env in docker-compose.

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY agent_service/requirements.txt /tmp/agent-requirements.txt
COPY rag/requirements.txt /tmp/rag-requirements.txt
RUN pip install -r /tmp/agent-requirements.txt -r /tmp/rag-requirements.txt

COPY agent/ /app/agent/
COPY agent_service/ /app/agent_service/
COPY rag/ /app/rag/

CMD ["python", "-m", "agent_service.cron"]
