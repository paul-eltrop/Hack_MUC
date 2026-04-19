# Portal: FastAPI + SQLite + Qdrant (file-based) + Docling.
# Context is the repo root so we can copy `rag/` alongside `portal/`.
# Runtime paths: QDRANT_PATH + PORTAL_DB_PATH are set via env in docker-compose.

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY portal/requirements.txt /tmp/portal-requirements.txt
COPY rag/requirements.txt /tmp/rag-requirements.txt
RUN pip install -r /tmp/portal-requirements.txt -r /tmp/rag-requirements.txt

COPY portal/ /app/portal/
COPY rag/ /app/rag/

EXPOSE 8000
CMD ["uvicorn", "portal.main:app", "--host", "0.0.0.0", "--port", "8000"]
