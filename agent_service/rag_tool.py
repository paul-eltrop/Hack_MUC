# Wrapper für rag/rag.py:retrieve() — leitet Anfragen vom Agent an den
# lokalen Qdrant-Index weiter und gibt nur die Felder zurück, die der
# Agent für seine Tool-Output-Verarbeitung braucht.

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


def search(query: str, top_k: int = 5) -> list[dict]:
    try:
        from rag import rag as rag_module
    except ImportError as exc:
        return [{"error": f"rag module unavailable: {exc}"}]

    try:
        chunks = rag_module.retrieve(query, top_k=top_k)
        return [
            {
                "text": c["text"][:600],
                "score": round(c["score"], 3),
                "doc_id": c.get("doc_id"),
                "source": c.get("source"),
            }
            for c in chunks
        ]
    except Exception as exc:
        return [{"error": f"rag.retrieve failed: {exc}"}]
