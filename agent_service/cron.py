# Cron-artiger Wrapper: ruft run_once() in einem Endlos-Loop alle 5 Minuten auf.
# Fängt Exceptions damit der Loop weiterläuft auch wenn ein Run fehlschlägt.
# Start via: python -m agent_service.cron

import time
import traceback
from datetime import datetime

from .loop import run_once

INTERVAL_SECONDS = 300


def main() -> None:
    print(f"[cron] starting agent_service loop (interval {INTERVAL_SECONDS}s)")
    while True:
        try:
            snap = run_once()
            print(f"[cron] {datetime.now().strftime('%H:%M:%S')} run {snap.get('runId')} ok")
        except Exception:
            print(f"[cron] {datetime.now().strftime('%H:%M:%S')} run failed:")
            traceback.print_exc()
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
