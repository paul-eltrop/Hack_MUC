# FastAPI backend für Shared Links, Chat und Dokument-Upload mit RAG-Ingestion.
# Speichert Share-Links in SQLite, nutzt Qdrant für Retrieval und Docling fürs Parsing.
# Serviert statische HTML-Seiten und verarbeitet Uploads (PDF/DOCX/PPTX/...)

import os, re, uuid, sqlite3, tempfile, hashlib
from pathlib import Path
from contextlib import asynccontextmanager

from docling.document_converter import DocumentConverter
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams, Filter, FieldCondition, MatchValue

load_dotenv(Path(__file__).parent.parent / ".env")

DB_PATH = Path(os.environ.get("PORTAL_DB_PATH") or Path(__file__).parent / "links.db")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
QDRANT_PATH = os.environ.get("QDRANT_PATH") or str(Path(__file__).parent.parent / "rag" / "qdrant_storage")
ACTIVE_COLLECTION = "documents"
EMBEDDING_DIM = 1536
MAX_UPLOAD_SIZE_BYTES = 30 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".pptx", ".xlsx", ".md", ".txt", ".html", ".htm", ".csv",
}
ARCHIVE_CATEGORIES = {"8d-report", "fmea", "lieferant", "werk", "spezifikation", "sonstiges"}
ARCHIVE_COMPANY_ID = "manex-archive"

openai_client = OpenAI()
qdrant = QdrantClient(path=QDRANT_PATH)
doc_converter = DocumentConverter()


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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rag_claims (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            link_id TEXT NOT NULL,
            doc_id TEXT NOT NULL,
            source TEXT NOT NULL,
            sentence TEXT NOT NULL,
            claim_key TEXT NOT NULL,
            claim_value TEXT NOT NULL,
            polarity INTEGER NOT NULL,
            numeric_value REAL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_claims_company_key ON rag_claims(company_id, claim_key)")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rag_documents (
            doc_id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            link_id TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_sha256 TEXT NOT NULL,
            source TEXT NOT NULL,
            status TEXT NOT NULL,
            reason TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_docs_company_hash ON rag_documents(company_id, file_sha256)")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS rag_contradictions (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL,
            link_id TEXT NOT NULL,
            new_doc_id TEXT NOT NULL,
            existing_doc_id TEXT NOT NULL,
            claim_key TEXT NOT NULL,
            reason TEXT NOT NULL,
            new_sentence TEXT,
            existing_sentence TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_contra_company_newdoc ON rag_contradictions(company_id, new_doc_id)")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS link_completions (
            link_id TEXT PRIMARY KEY,
            description TEXT,
            file_name TEXT,
            completed_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS archive_documents (
            doc_id TEXT PRIMARY KEY,
            file_name TEXT NOT NULL,
            file_sha256 TEXT NOT NULL UNIQUE,
            file_size_bytes INTEGER NOT NULL,
            mime_type TEXT,
            category TEXT NOT NULL,
            text_excerpt TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_archive_category ON archive_documents(category)")
    conn.commit()
    conn.close()


def _ensure_collection(name: str):
    if not qdrant.collection_exists(name):
        qdrant.create_collection(
            collection_name=name,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    _ensure_collection(ACTIVE_COLLECTION)
    yield


app = FastAPI(lifespan=lifespan)

_allowed_origins = [o.strip() for o in os.environ.get("PORTAL_ALLOW_ORIGIN", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def index_document(doc_id: str, text: str, metadata: dict, collection_name: str = ACTIVE_COLLECTION) -> None:
    chunks = chunk_text(text)
    if not chunks:
        raise ValueError("Dokument enthält keinen verwertbaren Text")
    vectors = embed(chunks)
    points = [
        PointStruct(
            id=str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{doc_id}-{i}")),
            vector=vector,
            payload={"doc_id": doc_id, "chunk_index": i, "text": chunk, **metadata},
        )
        for i, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    qdrant.upsert(collection_name=collection_name, points=points)


def retrieve(query: str, company_id: str, top_k: int = 5) -> list[dict]:
    query_vector = embed([query])[0]
    results = qdrant.query_points(
        collection_name=ACTIVE_COLLECTION,
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


def parse_document_with_docling(file_path: Path) -> str:
    result = doc_converter.convert(str(file_path))
    doc = getattr(result, "document", result)
    if hasattr(doc, "export_to_markdown"):
        return doc.export_to_markdown()
    if hasattr(doc, "export_to_text"):
        return doc.export_to_text()
    text = getattr(result, "text", "")
    if isinstance(text, str):
        return text
    return ""


def split_sentences(text: str) -> list[str]:
    chunks = re.split(r"[.!?]\s+|\n+", text)
    return [c.strip() for c in chunks if c and c.strip()]


def normalize_key(raw: str) -> str:
    text = raw.lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^a-z0-9äöüß _/-]", "", text)
    text = re.sub(r"\b(der|die|das|the|a|an)\b", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:80]


def normalize_value(raw: str) -> str:
    text = raw.lower().strip()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[,;]+$", "", text)
    return text[:120]


def parse_numeric(value: str) -> float | None:
    match = re.search(r"-?\d+(?:[.,]\d+)?", value)
    if not match:
        return None
    return float(match.group(0).replace(",", "."))


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def extract_claims(text: str) -> list[dict]:
    patterns = [
        (re.compile(r"^\s*([A-Za-z0-9ÄÖÜäöüß _/\-]{3,80})\s*[:=]\s*([^\n]{1,120})\s*$"), 1),
        (re.compile(r"^\s*([A-Za-z0-9ÄÖÜäöüß _/\-]{3,80})\s+(?:is|are|ist|sind)\s+(?:not|nicht|kein|keine)\s+([^\n]{1,120})\s*$", re.IGNORECASE), -1),
        (re.compile(r"^\s*([A-Za-z0-9ÄÖÜäöüß _/\-]{3,80})\s+(?:is|are|ist|sind)\s+([^\n]{1,120})\s*$", re.IGNORECASE), 1),
    ]
    claims: list[dict] = []
    seen: set[tuple[str, str, int]] = set()
    for sentence in split_sentences(text):
        cleaned_sentence = sentence.strip().strip("-").strip()
        if len(cleaned_sentence) < 6:
            continue
        for pattern, polarity in patterns:
            match = pattern.match(cleaned_sentence)
            if not match:
                continue
            key_raw, value_raw = match.group(1), match.group(2)
            claim_key = normalize_key(key_raw)
            claim_value = normalize_value(value_raw)
            if not claim_key or not claim_value:
                continue
            signature = (claim_key, claim_value, polarity)
            if signature in seen:
                continue
            seen.add(signature)
            claims.append(
                {
                    "sentence": cleaned_sentence[:240],
                    "claim_key": claim_key,
                    "claim_value": claim_value,
                    "polarity": polarity,
                    "numeric_value": parse_numeric(claim_value),
                }
            )
            break
    return claims


def detect_contradictions(company_id: str, doc_id: str, claims: list[dict], source: str) -> list[dict]:
    if not claims:
        return []

    keys = sorted({claim["claim_key"] for claim in claims})
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    placeholders = ",".join(["?"] * len(keys))
    rows = conn.execute(
        f"""
        SELECT id, doc_id, source, sentence, claim_key, claim_value, polarity, numeric_value
        FROM rag_claims
        WHERE company_id = ?
          AND claim_key IN ({placeholders})
          AND doc_id <> ?
        """,
        [company_id, *keys, doc_id],
    ).fetchall()
    conn.close()

    existing_by_key: dict[str, list[sqlite3.Row]] = {}
    for row in rows:
        existing_by_key.setdefault(row["claim_key"], []).append(row)

    contradictions: list[dict] = []
    for claim in claims:
        key = claim["claim_key"]
        for existing in existing_by_key.get(key, []):
            numeric_new = claim["numeric_value"]
            numeric_old = existing["numeric_value"]
            opposite_polarity = claim["polarity"] * int(existing["polarity"]) == -1
            different_numeric = (
                numeric_new is not None
                and numeric_old is not None
                and abs(float(numeric_new) - float(numeric_old)) > 1e-9
            )
            different_text = (
                claim["claim_value"] != existing["claim_value"]
                and numeric_new is None
                and numeric_old is None
            )
            if opposite_polarity or different_numeric or different_text:
                reason = "opposite_polarity" if opposite_polarity else "different_value"
                contradictions.append(
                    {
                        "reason": reason,
                        "claim_key": key,
                        "new": {
                            "doc_id": doc_id,
                            "source": source,
                            "sentence": claim["sentence"],
                            "claim_value": claim["claim_value"],
                            "polarity": claim["polarity"],
                        },
                        "existing": {
                            "doc_id": existing["doc_id"],
                            "source": existing["source"],
                            "sentence": existing["sentence"],
                            "claim_value": existing["claim_value"],
                            "polarity": int(existing["polarity"]),
                        },
                    }
                )
    return contradictions


def store_claims(company_id: str, link_id: str, doc_id: str, source: str, claims: list[dict]) -> None:
    if not claims:
        return
    conn = sqlite3.connect(DB_PATH)
    conn.executemany(
        """
        INSERT INTO rag_claims (
            id, company_id, link_id, doc_id, source, sentence, claim_key, claim_value, polarity, numeric_value
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                str(uuid.uuid4()),
                company_id,
                link_id,
                doc_id,
                source,
                claim["sentence"],
                claim["claim_key"],
                claim["claim_value"],
                int(claim["polarity"]),
                claim["numeric_value"],
            )
            for claim in claims
        ],
    )
    conn.commit()
    conn.close()


def store_document_status(
    doc_id: str,
    company_id: str,
    link_id: str,
    file_name: str,
    file_sha256: str,
    source: str,
    status: str,
    reason: str = "",
) -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        INSERT OR REPLACE INTO rag_documents (
            doc_id, company_id, link_id, file_name, file_sha256, source, status, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (doc_id, company_id, link_id, file_name, file_sha256, source, status, reason),
    )
    conn.commit()
    conn.close()


def find_document_by_hash(company_id: str, file_sha256: str) -> sqlite3.Row | None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        """
        SELECT doc_id, status, reason, link_id, created_at
        FROM rag_documents
        WHERE company_id = ? AND file_sha256 = ?
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (company_id, file_sha256),
    ).fetchone()
    conn.close()
    return row


def store_contradictions(company_id: str, link_id: str, new_doc_id: str, contradictions: list[dict]) -> None:
    if not contradictions:
        return
    conn = sqlite3.connect(DB_PATH)
    conn.executemany(
        """
        INSERT INTO rag_contradictions (
            id, company_id, link_id, new_doc_id, existing_doc_id, claim_key, reason, new_sentence, existing_sentence
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                str(uuid.uuid4()),
                company_id,
                link_id,
                new_doc_id,
                c["existing"]["doc_id"],
                c["claim_key"],
                c["reason"],
                c["new"]["sentence"],
                c["existing"]["sentence"],
            )
            for c in contradictions
        ],
    )
    conn.commit()
    conn.close()


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


class InvestigationCloseRequest(BaseModel):
    investigation_id: str
    investigation: dict
    tasks: list[dict]


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


@app.get("/share/links/{link_id}/status")
def get_link_status(link_id: str):
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT description, file_name, completed_at FROM link_completions WHERE link_id = ?", (link_id,)
    ).fetchone()
    conn.close()
    if not row:
        return {"completed": False}
    return {"completed": True, "description": row[0], "file_name": row[1], "completed_at": row[2]}


PROOFS_DIR = Path(__file__).parent / "proofs"

@app.post("/share/links/{link_id}/complete")
async def complete_link(link_id: str, description: str = Form(""), file: UploadFile = File(None)):
    get_link(link_id)
    file_name = None
    if file and file.filename:
        file_bytes = await file.read()
        file_name = file.filename
        suffix = Path(file_name).suffix.lower()
        PROOFS_DIR.mkdir(exist_ok=True)
        proof_path = PROOFS_DIR / f"{link_id}{suffix}"
        proof_path.write_bytes(file_bytes)
        if suffix in ALLOWED_EXTENSIONS:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(file_bytes)
                temp_path = Path(tmp.name)
            try:
                parsed_text = parse_document_with_docling(temp_path).strip()
                if parsed_text:
                    doc_id = f"proof-{link_id}-{uuid.uuid5(uuid.NAMESPACE_DNS, file_name).hex[:10]}"
                    index_document(doc_id, parsed_text, {"source": file_name, "link_id": link_id, "type": "proof"})
            except Exception:
                pass
            finally:
                temp_path.unlink(missing_ok=True)

    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO link_completions (link_id, description, file_name) VALUES (?, ?, ?)",
        (link_id, description, file_name),
    )
    conn.commit()
    conn.close()
    return {"ok": True, "link_id": link_id}


@app.get("/share/links/{link_id}/proof-file")
def download_proof(link_id: str):
    from fastapi.responses import FileResponse as FR
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT file_name FROM link_completions WHERE link_id = ?", (link_id,)).fetchone()
    conn.close()
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="No file")
    suffix = Path(row[0]).suffix.lower()
    proof_path = PROOFS_DIR / f"{link_id}{suffix}"
    if not proof_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FR(str(proof_path), filename=row[0])


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


@app.post("/share/upload")
async def upload_document(
    link_id: str = Form(...),
    file: UploadFile = File(...),
):
    link = get_link(link_id)

    filename = file.filename or "document"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Dateityp nicht unterstützt: {suffix or 'ohne Endung'}",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Datei ist leer")
    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Datei ist zu groß (max 30 MB)")
    file_sha256 = sha256_hex(file_bytes)
    source = "uploaded-document"

    existing = find_document_by_hash(link["company_id"], file_sha256)
    if existing and existing["status"] == "accepted":
        return {
            "ok": True,
            "deduplicated": True,
            "message": "Datei bereits verifiziert und indexiert",
            "doc_id": existing["doc_id"],
            "link_id": existing["link_id"],
            "company_id": link["company_id"],
            "file_name": filename,
        }
    if existing and existing["status"] in {"quarantined", "rejected"}:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Datei wurde zuvor wegen Datenkonflikt blockiert",
                "previous_doc_id": existing["doc_id"],
                "status": existing["status"],
                "reason": existing["reason"],
            },
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        temp_path = Path(tmp.name)

    try:
        parsed_text = parse_document_with_docling(temp_path).strip()
        if not parsed_text:
            raise HTTPException(status_code=400, detail="Kein Text im Dokument erkannt")

        doc_id = f"upload-{link_id}-{uuid.uuid4().hex[:10]}"
        claims = extract_claims(parsed_text)
        contradictions = detect_contradictions(
            company_id=link["company_id"],
            doc_id=doc_id,
            claims=claims,
            source=source,
        )
        if contradictions:
            store_document_status(
                doc_id=doc_id,
                company_id=link["company_id"],
                link_id=link_id,
                file_name=filename,
                file_sha256=file_sha256,
                source=source,
                status="quarantined",
                reason="contradictory_claims",
            )
            store_contradictions(link["company_id"], link_id, doc_id, contradictions)
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Upload blockiert: Widerspruch zu bestehendem RAG-Wissen erkannt",
                    "status": "quarantined",
                    "doc_id": doc_id,
                    "contradictions_found": len(contradictions),
                    "contradictions": contradictions[:20],
                },
            )

        index_document(
            doc_id,
            parsed_text,
            {
                "source": source,
                "company_id": link["company_id"],
                "link_id": link_id,
                "file_name": filename,
                "ingestion_status": "accepted",
            },
        )
        store_claims(
            company_id=link["company_id"],
            link_id=link_id,
            doc_id=doc_id,
            source=source,
            claims=claims,
        )
        store_document_status(
            doc_id=doc_id,
            company_id=link["company_id"],
            link_id=link_id,
            file_name=filename,
            file_sha256=file_sha256,
            source=source,
            status="accepted",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Dokument konnte nicht verarbeitet werden: {exc}") from exc
    finally:
        temp_path.unlink(missing_ok=True)

    return {
        "ok": True,
        "link_id": link_id,
        "company_id": link["company_id"],
        "file_name": filename,
        "doc_id": doc_id,
        "status": "accepted",
        "claims_extracted": len(claims),
        "contradictions_found": len(contradictions),
        "contradictions": contradictions[:20],
    }


class ArchiveDocument(BaseModel):
    doc_id: str
    file_name: str
    file_size_bytes: int
    mime_type: str | None = None
    category: str
    text_excerpt: str | None = None
    created_at: str


def _archive_row_to_dict(row: sqlite3.Row) -> dict:
    return {
        "doc_id": row["doc_id"],
        "file_name": row["file_name"],
        "file_size_bytes": int(row["file_size_bytes"]),
        "mime_type": row["mime_type"],
        "category": row["category"],
        "text_excerpt": row["text_excerpt"],
        "created_at": row["created_at"],
    }


@app.post("/archive/upload")
async def archive_upload(
    file: UploadFile = File(...),
    category: str = Form(...),
):
    if category not in ARCHIVE_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Unbekannte Kategorie '{category}'. Erlaubt: {sorted(ARCHIVE_CATEGORIES)}",
        )

    filename = file.filename or "document"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Dateityp nicht unterstützt: {suffix or 'ohne Endung'}")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Datei ist leer")
    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Datei ist zu groß (max 30 MB)")

    file_sha256 = sha256_hex(file_bytes)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    existing = conn.execute(
        "SELECT doc_id, file_name, category FROM archive_documents WHERE file_sha256 = ?",
        (file_sha256,),
    ).fetchone()
    conn.close()
    if existing:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Datei ist bereits im Archiv",
                "doc_id": existing["doc_id"],
                "file_name": existing["file_name"],
                "category": existing["category"],
            },
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        temp_path = Path(tmp.name)

    try:
        parsed_text = parse_document_with_docling(temp_path).strip()
        if not parsed_text:
            raise HTTPException(status_code=400, detail="Kein Text im Dokument erkannt")

        doc_id = f"ARC-{uuid.uuid4().hex[:12].upper()}"
        excerpt = parsed_text[:240]

        index_document(
            doc_id,
            parsed_text,
            {
                "source": "archive",
                "company_id": ARCHIVE_COMPANY_ID,
                "category": category,
                "file_name": filename,
            },
        )

        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute(
            """
            INSERT INTO archive_documents (
                doc_id, file_name, file_sha256, file_size_bytes, mime_type, category, text_excerpt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (doc_id, filename, file_sha256, len(file_bytes), file.content_type, category, excerpt),
        )
        conn.commit()
        row = conn.execute(
            "SELECT doc_id, file_name, file_size_bytes, mime_type, category, text_excerpt, created_at "
            "FROM archive_documents WHERE doc_id = ?",
            (doc_id,),
        ).fetchone()
        conn.close()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Dokument konnte nicht verarbeitet werden: {exc}") from exc
    finally:
        temp_path.unlink(missing_ok=True)

    return _archive_row_to_dict(row)


@app.get("/archive/documents")
def archive_list():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT doc_id, file_name, file_size_bytes, mime_type, category, text_excerpt, created_at "
        "FROM archive_documents ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [_archive_row_to_dict(r) for r in rows]


@app.delete("/archive/documents/{doc_id}")
def archive_delete(doc_id: str):
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute(
        "SELECT doc_id FROM archive_documents WHERE doc_id = ?", (doc_id,)
    ).fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail=f"Dokument '{doc_id}' nicht im Archiv")

    doc_filter = Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))])
    deleted_chunks = qdrant.count(
        collection_name=ACTIVE_COLLECTION, count_filter=doc_filter, exact=True
    ).count
    qdrant.delete(collection_name=ACTIVE_COLLECTION, points_selector=doc_filter)

    conn.execute("DELETE FROM archive_documents WHERE doc_id = ?", (doc_id,))
    conn.commit()
    conn.close()
    return {"ok": True, "doc_id": doc_id, "deleted_chunks": deleted_chunks}


@app.get("/debug/rag")
def debug_rag():
    if not qdrant.collection_exists(ACTIVE_COLLECTION):
        return {"total": 0, "points": []}
    points = qdrant.scroll(collection_name=ACTIVE_COLLECTION, limit=200, with_payload=True)[0]
    return {
        "total": len(points),
        "points": [
            {"id": str(p.id), "source": p.payload.get("source"), "company_id": p.payload.get("company_id"), "text": p.payload.get("text", "")[:300]}
            for p in points
        ],
    }


@app.get("/share/uploads/{link_id}")
def list_uploads(link_id: str):
    link = get_link(link_id)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT doc_id, file_name, status, reason, source, created_at
        FROM rag_documents
        WHERE company_id = ? AND link_id = ?
        ORDER BY created_at DESC
        """,
        (link["company_id"], link_id),
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]


app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


INVESTIGATION_COMPANY_ID = "manex"


@app.post("/investigation/upload")
async def investigation_upload(
    investigation_id: str = Form(...),
    file: UploadFile = File(...),
):
    filename = file.filename or "document"
    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Dateityp nicht unterstützt: {suffix}")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Datei ist leer")
    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="Datei zu groß (max 30 MB)")

    file_sha256 = sha256_hex(file_bytes)

    existing = find_document_by_hash(INVESTIGATION_COMPANY_ID, file_sha256)
    if existing and existing["status"] == "accepted":
        return {
            "ok": True,
            "deduplicated": True,
            "message": "Datei bereits indexiert",
            "doc_id": existing["doc_id"],
            "file_name": filename,
        }
    if existing and existing["status"] in {"quarantined", "rejected"}:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Datei wurde zuvor wegen Datenkonflikt blockiert",
                "status": existing["status"],
                "reason": existing["reason"],
            },
        )

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(file_bytes)
        temp_path = Path(tmp.name)

    try:
        parsed_text = parse_document_with_docling(temp_path).strip()
        if not parsed_text:
            raise HTTPException(status_code=400, detail="Kein Text im Dokument erkannt")

        doc_id = f"inv-{investigation_id}-{uuid.uuid5(uuid.NAMESPACE_DNS, file_sha256).hex[:10]}"
        claims = extract_claims(parsed_text)
        contradictions = detect_contradictions(
            company_id=INVESTIGATION_COMPANY_ID,
            doc_id=doc_id,
            claims=claims,
            source=filename,
        )

        if contradictions:
            store_document_status(
                doc_id=doc_id,
                company_id=INVESTIGATION_COMPANY_ID,
                link_id=investigation_id,
                file_name=filename,
                file_sha256=file_sha256,
                source=filename,
                status="quarantined",
                reason="contradictory_claims",
            )
            store_contradictions(INVESTIGATION_COMPANY_ID, investigation_id, doc_id, contradictions)
            raise HTTPException(
                status_code=409,
                detail={
                    "message": "Upload blockiert: Widerspruch zu bestehendem RAG-Wissen erkannt",
                    "status": "quarantined",
                    "doc_id": doc_id,
                    "contradictions_found": len(contradictions),
                    "contradictions": contradictions[:5],
                },
            )

        index_document(
            doc_id,
            parsed_text,
            {
                "source": filename,
                "investigation_id": investigation_id,
                "company_id": INVESTIGATION_COMPANY_ID,
                "file_name": filename,
            },
        )
        store_claims(INVESTIGATION_COMPANY_ID, investigation_id, doc_id, filename, claims)
        store_document_status(
            doc_id=doc_id,
            company_id=INVESTIGATION_COMPANY_ID,
            link_id=investigation_id,
            file_name=filename,
            file_sha256=file_sha256,
            source=filename,
            status="accepted",
        )
        return {
            "ok": True,
            "doc_id": doc_id,
            "chunks": len(chunk_text(parsed_text)),
            "claims_extracted": len(claims),
            "file_name": filename,
        }
    finally:
        temp_path.unlink(missing_ok=True)


@app.post("/investigation/retrieve")
async def investigation_retrieve(body: dict):
    query: str = body.get("query", "")
    investigation_id: str = body.get("investigation_id", "")
    if not query:
        raise HTTPException(status_code=400, detail="query fehlt")

    query_vector = embed([query])[0]
    filter_condition = Filter(
        must=[FieldCondition(key="investigation_id", match=MatchValue(value=investigation_id))]
    ) if investigation_id else None

    results = qdrant.query_points(
        collection_name=ACTIVE_COLLECTION,
        query=query_vector,
        query_filter=filter_condition,
        limit=5,
        with_payload=True,
    ).points
    return [
        {"text": r.payload["text"], "source": r.payload.get("file_name", "unknown"), "score": r.score}
        for r in results
    ]


@app.post("/investigation/close")
def investigation_close(req: InvestigationCloseRequest):
    if not req.tasks:
        raise HTTPException(status_code=400, detail="Keine Tasks übergeben")
    if any(str(task.get("status", "")).lower() != "completed" for task in req.tasks):
        raise HTTPException(status_code=400, detail="Nicht alle Tasks sind completed")

    inv = req.investigation or {}
    timeline = inv.get("timeline") or []
    affected = inv.get("affectedProducts") or []

    task_lines = []
    for idx, task in enumerate(req.tasks, 1):
        assignees = ", ".join(task.get("assignees") or [])
        proof_desc = (task.get("proofDescription") or "").strip()
        proof_file = (task.get("proofFileName") or "").strip()
        link_id = (task.get("linkId") or "").strip()
        parts = [f"{idx}. {task.get('text', '')}".strip()]
        if assignees:
            parts.append(f"Owner: {assignees}")
        if proof_desc:
            parts.append(f"Nachweis: {proof_desc}")
        if proof_file:
            parts.append(f"Datei: {proof_file}")
        if link_id:
            parts.append(f"Share-Link: {link_id}")
        task_lines.append(" | ".join(parts))

    timeline_lines = [
        f"- {entry.get('date', '')}: {entry.get('event', '')}" for entry in timeline if entry.get("event")
    ]
    affected_lines = [
        f"- {product.get('id', '')}: {product.get('name', '')}" for product in affected if product.get("name")
    ]

    raw_context = "\n".join(
        [
            f"Investigation-ID: {req.investigation_id}",
            f"Titel: {inv.get('title', '')}",
            f"Schweregrad: {inv.get('severity', '')}",
            f"Quelle: {inv.get('source', '')}",
            f"Summary: {inv.get('summary', '')}",
            f"Root Cause: {inv.get('rootCause', '')}",
            f"Defects: {inv.get('defects', 0)} | Claims: {inv.get('claims', 0)} | Risk: {inv.get('risk', 0)}",
            "",
            "Betroffene Produkte:",
            *affected_lines,
            "",
            "Timeline:",
            *timeline_lines,
            "",
            "Abgeschlossene Tasks inklusive Notizen aus Share-Links:",
            *task_lines,
        ]
    ).strip()

    summary_prompt = (
        "Fasse den Fall für eine RAG-Wissensbasis auf Deutsch zusammen. "
        "Nenne Problem, Evidenz/Notizen, umgesetzte Lösungsschritte und Ergebnis. "
        "Schreibe kompakt und faktisch."
    )

    summary_text = raw_context
    try:
        summary_response = openai_client.chat.completions.create(
            model="gpt-4o",
            max_tokens=650,
            messages=[
                {"role": "system", "content": summary_prompt},
                {"role": "user", "content": raw_context},
            ],
        )
        content = summary_response.choices[0].message.content
        if content and content.strip():
            summary_text = content.strip()
    except Exception:
        pass

    doc_id = f"inv-close-{req.investigation_id}-{uuid.uuid4().hex[:8]}"
    index_document(
        doc_id,
        summary_text,
        {
            "source": "investigation-closure",
            "investigation_id": req.investigation_id,
            "company_id": INVESTIGATION_COMPANY_ID,
            "file_name": f"{req.investigation_id}-closure-summary.md",
        },
    )
    store_document_status(
        doc_id=doc_id,
        company_id=INVESTIGATION_COMPANY_ID,
        link_id=req.investigation_id,
        file_name=f"{req.investigation_id}-closure-summary.md",
        file_sha256=sha256_hex(summary_text.encode("utf-8")),
        source="investigation-closure",
        status="accepted",
    )

    return {"ok": True, "doc_id": doc_id, "summary": summary_text}


@app.get("/")
def root():
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/share/{link_id}")
def share_page(link_id: str):
    return FileResponse(Path(__file__).parent / "static" / "share.html")
