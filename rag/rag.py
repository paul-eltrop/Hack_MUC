# RAG-Pipeline: Dokumente in Qdrant indexieren, relevante Chunks abrufen und
# mit GPT-4o Fragen auf Basis der Dokumente beantworten.
# Daten werden lokal in ./qdrant_storage gespeichert, kein Server nötig.

import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

load_dotenv(Path(__file__).parent.parent / ".env")

COLLECTION = "documents"
EMBEDDING_DIM = 1536

openai_client = OpenAI()
qdrant = QdrantClient(path=os.environ.get("QDRANT_PATH", "./qdrant_storage"))


def _ensure_collection() -> None:
    if not qdrant.collection_exists(COLLECTION):
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + chunk_size]))
        i += chunk_size - overlap
    return chunks


def embed(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(
        model="text-embedding-3-small",
        input=texts,
    )
    return [item.embedding for item in response.data]


def index_document(doc_id: str, text: str, metadata: dict) -> None:
    _ensure_collection()
    chunks = chunk_text(text)
    vectors = embed(chunks)
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector=vector,
            payload={"doc_id": doc_id, "chunk_index": i, "text": chunk, **metadata},
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    qdrant.upsert(collection_name=COLLECTION, points=points)


def retrieve(query: str, top_k: int = 5) -> list[dict]:
    query_vector = embed([query])[0]
    results = qdrant.query_points(
        collection_name=COLLECTION,
        query=query_vector,
        limit=top_k,
        with_payload=True,
    ).points
    return [
        {
            "text": hit.payload["text"],
            "score": hit.score,
            "doc_id": hit.payload["doc_id"],
            "source": hit.payload.get("source", "unknown"),
        }
        for hit in results
    ]


def build_prompt(query: str, chunks: list[dict]) -> str:
    context = "\n\n---\n\n".join(
        f"[Quelle: {c['source']}]\n{c['text']}" for c in chunks
    )
    return (
        "Du beantwortest Fragen ausschließlich auf Basis der folgenden Dokumente.\n"
        "Wenn die Antwort nicht in den Dokumenten steht, sage das explizit.\n\n"
        f"DOKUMENTE:\n{context}\n\n"
        f"FRAGE:\n{query}\n\n"
        "ANTWORT:"
    )


def answer(query: str) -> str:
    chunks = retrieve(query, top_k=5)
    prompt = build_prompt(query, chunks)
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


# Aufruf: python agent/rag.py
# Benötigt OPENAI_API_KEY, ANTHROPIC_API_KEY in .env. Daten landen in ./qdrant_storage.
# index_document() zum Indexieren, answer() zum Abfragen verwenden.
if __name__ == "__main__":
    index_document(
        doc_id="beispiel",
        text="Manex GmbH ist ein Elektronikhersteller. Das Team analysiert Qualitätsprobleme in der Fertigung.",
        metadata={"source": "beispiel.txt"},
    )
    print(answer("Was macht Manex?"))
