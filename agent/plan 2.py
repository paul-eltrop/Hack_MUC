# Nimmt den Output von analyze.py entgegen und schreibt pro Story eine langfristige
# Abstellmaßnahme als product_action-Eintrag in die Manex-Datenbank.

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).parent.parent / ".env")

DB_URL = os.environ["MANEX_DB_URL"]
openai_client = OpenAI()

ACTION_TYPE = "corrective_longterm"
STATUS = "open"
USER_ID = "quality_copilot"


def next_action_id(cur: psycopg2.extensions.cursor) -> str:
    cur.execute("SELECT action_id FROM product_action ORDER BY action_id DESC LIMIT 1")
    row = cur.fetchone()
    if not row:
        return "PA-00001"
    last_num = int(row["action_id"].split("-")[1])
    return f"PA-{last_num + 1:05d}"


def generate_massnahme(story: dict) -> str:
    import json as _json
    raw_summary = _json.dumps(story.get("raw_data", {}), ensure_ascii=False, indent=2)
    prompt = (
        "Du bist leitender Qualitätsingenieur bei Manex GmbH und erstellst einen 8D-Bericht.\n"
        "Formuliere eine präzise, langfristige Abstellmaßnahme (D6/D7) mit 4-6 Sätzen.\n"
        "Anforderungen:\n"
        "- Beziehe dich auf konkrete Zahlen und Entitäten aus den Rohdaten (Chargen-IDs, Defektanzahlen, Zeiträume, Bauteilnummern, Operatoren)\n"
        "- Nenne die spezifische Ursache und was strukturell geändert wird\n"
        "- Gib an wer verantwortlich ist (Rolle) und in welchem Zeitraum\n"
        "- Verwende NICHT den Präfix 'Erfolg:'\n"
        "\n\n"
        f"Problem-ID: {story['id']}\n"
        f"Root Cause: {story['root_cause']}\n"
        f"Muster: {story['pattern']} — {story['pattern_beschreibung']}\n\n"
        f"Rohdaten:\n{raw_summary}"
    )
    response = openai_client.chat.completions.create(
        model="gpt-4o",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.choices[0].message.content.strip()
    # Defensive Nachbearbeitung: entfernt den unerwünschten Präfix zuverlässig.
    return re.sub(r"(?i)\bErfolg\s*:\s*", "", text)


def first_product_id(story: dict) -> str | None:
    raw = story.get("raw_data", {})
    detail = raw.get("betroffene_produkte_detail") or raw.get("betroffene_produkte") or []
    if detail and isinstance(detail[0], dict):
        return detail[0].get("product_id")
    return None


def run(analysis: dict) -> None:
    stories = analysis["root_cause_analysis"]["stories"]
    conn = psycopg2.connect(DB_URL)

    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for story in stories:
                product_id = first_product_id(story)
                if not product_id:
                    print(f"  ⚠ {story['id']}: kein Produkt gefunden, übersprungen")
                    continue

                action_id = next_action_id(cur)
                massnahme = generate_massnahme(story)

                cur.execute(
                    """
                    INSERT INTO product_action (action_id, product_id, ts, action_type, status, user_id, comments)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        action_id,
                        product_id,
                        datetime.now(timezone.utc),
                        ACTION_TYPE,
                        STATUS,
                        USER_ID,
                        f"[{story['id']}] {massnahme}",
                    ),
                )
                conn.commit()
                print(f"  ✓ {action_id} → {story['id']} ({product_id})")
                print(f"    {massnahme[:120]}…\n")
    finally:
        conn.close()


# Aufruf: python agent/plan.py
# Ruft analyze.run() direkt auf und schreibt Abstellmaßnahmen in product_action.
if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    from analyze import run as analyze_run
    run(analyze_run())
