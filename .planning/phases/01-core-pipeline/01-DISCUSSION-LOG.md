# Phase 1: Core Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 1-core-pipeline
**Areas discussed:** Projudi navigation flow

---

## Projudi Navigation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Start at homepage, click through to consulta pública | Navigate from https://projudi.tjba.jus.br/projudi/ | ✓ |
| Direct URL to consulta form | Skip homepage, go straight to search form | |

**User's choice:** Start at homepage

---

| Option | Description | Selected |
|--------|-------------|----------|
| Launch headless Chromium per run | Playwright's own Chromium, no UI, cron-friendly | ✓ |
| Connect to existing Chrome via CDP | Requires Chrome running with --remote-debugging-port | |

**User's choice:** Headless Chromium per run

---

| Option | Description | Selected |
|--------|-------------|----------|
| CNJ number format (0097638-10.2026.8.05.0001) | Standard court process number | |
| Teor hash format (e.g., 1d49c1c15b8c) | Short hash used in the "consulta por teor" search | ✓ |

**User's choice:** Teor hash  
**Notes:** User shared `projudi.md` showing the teor hash `1d49c1c15b8c` and the URL `https://projudi.tjba.jus.br/projudi/`. After clicking "Consulta Pública" and typing the hash + Enter, the browser goes directly to the "DADOS DO PROCESSO" page with the "Etapas do Processo" table.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Data + descrição | Composite ID from date and movimentação text, NFC-normalized | ✓ |
| Posição na tabela | Row index — fragile if rows are reordered | |
| Claude's discretion | Let planner decide | |

**User's choice:** Data + descrição  
**Notes:** Robust against row-order changes. Both fields NFC-normalized and trimmed before composing the ID.

---

## Claude's Discretion

- Terminal output format (labels, separators, timestamps for new movimentações)
- Internal code structure (single `index.js` vs. separate scraper/state/diff modules)
- Exact selector strings for Projudi DOM elements (researcher to identify from live DOM)

## Deferred Ideas

None — discussion stayed within phase 1 scope.
