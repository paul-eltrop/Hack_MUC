# FastAPI backend für das Shared Links + Chat Interface + Auto-RAG-Ingestion Portal.
# Speichert Share-Links in SQLite, nutzt Qdrant für RAG, serviert statische HTML-Seiten.

import os, uuid, sqlite3
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams, Filter, FieldCondition, MatchValue

load_dotenv(Path(__file__).parent.parent / ".env")

DB_PATH = Path(__file__).parent / "links.db"
QDRANT_PATH = str(Path(__file__).parent.parent / "rag" / "qdrant_storage")
COLLECTION = "documents"
EMBEDDING_DIM = 1536

openai_client = OpenAI()
qdrant = QdrantClient(path=QDRANT_PATH)


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS share_links (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            welcome_message TEXT NOT NULL,
            topic TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.commit()
    conn.close()


def _ensure_collection():
    if not qdrant.collection_exists(COLLECTION):
        qdrant.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _ensure_collection()
    yield


app = FastAPI(lifespan=lifespan)


def embed(texts: list[str]) -> list[list[float]]:
    response = openai_client.embeddings.create(model="text-embedding-3-small", input=texts)
    return [item.embedding for item in response.data]


def chunk_text(text: str, chunk_size: int = 512, overlap: int = 64) -> list[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + chunk_size]))
        i += chunk_size - overlap
    return chunks


def index_document(doc_id: str, text: str, metadata: dict) -> None:
    chunks = chunk_text(text)
    vectors = embed(chunks)
    points = [
        PointStruct(
            id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}-{i}")),
            vector=vector,
            payload={"doc_id": doc_id, "chunk_index": i, "text": chunk, **metadata},
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    qdrant.upsert(collection_name=COLLECTION, points=points)


def retrieve(query: str, company_id: str, top_k: int = 5) -> list[dict]:
    query_vector = embed([query])[0]
    results = qdrant.query_points(
        collection_name=COLLECTION,
        query=query_vector,
        limit=top_k,
        with_payload=True,
        query_filter=Filter(
            must=[FieldCondition(key="company_id", match=MatchValue(value=company_id))]
        ),
    ).points
    return [
        {"text": r.payload["text"], "score": r.score, "source": r.payload.get("source", "chat")}
        for r in results
    ]


def extract_facts(user_message: str, assistant_reply: str) -> str:
    prompt = (
        "Extract 2-5 concise factual statements from this conversation exchange. "
        "Return only the facts as a numbered list, no explanations.\n\n"
        f"User: {user_message}\nAssistant: {assistant_reply}"
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content


# Share-Link-Logik:
# Ein Share-Link ist eine öffentliche Chat-Session mit einer festen company_id.
# POST /share/links  → erstellt einen Link (8-stellige ID, gespeichert in SQLite).
# GET  /share/links/{id} → gibt Konfiguration zurück (welcome_message, topic, company_id).
# POST /share/chat   → nimmt Nutzernachricht + History entgegen, sucht per RAG im Qdrant
#                      (gefiltert nach company_id), antwortet via GPT-4o und indexiert
#                      automatisch extrahierte Fakten zurück in Qdrant (Auto-RAG-Ingestion).
#                      Enthält die Nachricht [COLLECTION_COMPLETE], wird zusätzlich eine
#                      Gesprächszusammenfassung in Qdrant geschrieben.
class CreateLinkRequest(BaseModel):
    company_id: str
    welcome_message: str
    topic: str = ""


class ChatRequest(BaseModel):
    link_id: str
    message: str
    history: list[dict] = []


@app.post("/share/links")
def create_link(req: CreateLinkRequest):
    link_id = str(uuid.uuid4())[:8]
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO share_links (id, company_id, welcome_message, topic) VALUES (?, ?, ?, ?)",
        (link_id, req.company_id, req.welcome_message, req.topic),
    )
    conn.commit()
    conn.close()
    return {"id": link_id, "url": f"/share/{link_id}"}


@app.get("/share/links")
def list_links():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute(
        "SELECT id, company_id, welcome_message, topic, created_at FROM share_links ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [
        {"id": r[0], "company_id": r[1], "welcome_message": r[2], "topic": r[3], "created_at": r[4]}
        for r in rows
    ]


@app.get("/share/links/{link_id}")
def get_link(link_id: str):
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT id, company_id, welcome_message, topic FROM share_links WHERE id = ?", (link_id,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Link not found")
    return {"id": row[0], "company_id": row[1], "welcome_message": row[2], "topic": row[3]}


@app.post("/share/chat")
def chat(req: ChatRequest):
    link = get_link(req.link_id)

    is_complete = "[COLLECTION_COMPLETE]" in req.message
    clean_message = req.message.replace("[COLLECTION_COMPLETE]", "").strip()

    chunks = retrieve(clean_message, company_id=link["company_id"])
    context = (
        "\n\n---\n\n".join(f"[Source: {c['source']}]\n{c['text']}" for c in chunks)
        if chunks
        else "Noch keine Dokumente in der Wissensbasis vorhanden."
    )

    system_prompt = (
        f"Du bist ein hilfreicher Assistent für {link['company_id']}. Thema: {link['topic']}.\n"
        "Beantworte Fragen basierend auf den bereitgestellten Kontext-Dokumenten. "
        "Wenn du es nicht weißt, sage das ehrlich.\n\n"
        f"KONTEXT:\n{context}"
    )

    messages = [{"role": "system", "content": system_prompt}]
    for h in req.history[-10:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": clean_message})

    response = openai_client.chat.completions.create(model="gpt-4o", max_tokens=1024, messages=messages)
    reply = response.choices[0].message.content

    facts = extract_facts(clean_message, reply)
    index_document(
        f"chat-{req.link_id}-{uuid.uuid4().hex[:8]}",
        facts,
        {"source": "chat-extraction", "company_id": link["company_id"], "link_id": req.link_id},
    )

    if is_complete:
        all_turns = req.history + [
            {"role": "user", "content": clean_message},
            {"role": "assistant", "content": reply},
        ]
        full_text = "\n".join(f"{h['role'].upper()}: {h['content']}" for h in all_turns)
        summary_response = openai_client.chat.completions.create(
            model="gpt-4o",
            max_tokens=500,
            messages=[{
                "role": "user",
                "content": f"Schreibe eine kompakte Zusammenfassung dieses Gesprächs mit allen wichtigen Fakten:\n\n{full_text}",
            }],
        )
        index_document(
            f"summary-{req.link_id}",
            summary_response.choices[0].message.content,
            {"source": "conversation-summary", "company_id": link["company_id"], "link_id": req.link_id},
        )

    return {"reply": reply, "facts_ingested": True, "complete": is_complete, "chunks_used": len(chunks)}


@app.get("/debug/rag")
def debug_rag():
    if not qdrant.collection_exists(COLLECTION):
        return {"total": 0, "points": []}
    points = qdrant.scroll(collection_name=COLLECTION, limit=200, with_payload=True)[0]
    return {
        "total": len(points),
        "points": [
            {"id": str(p.id), "source": p.payload.get("source"), "company_id": p.payload.get("company_id"), "text": p.payload.get("text", "")[:300]}
            for p in points
        ],
    }


app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


@app.get("/")
def root():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/share/{link_id}")
def share_page(link_id: str):
    return FileResponse(Path(__file__).parent / "static" / "share.html")
