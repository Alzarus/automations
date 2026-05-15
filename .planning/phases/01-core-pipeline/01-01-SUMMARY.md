---
phase: 01-core-pipeline
plan: 01
subsystem: projudi-monitor
tags: [playwright, scraping, jsf, state-management, cli]
dependency_graph:
  requires: []
  provides: [projudi-monitor/index.js, projudi-monitor/config/processes.json, projudi-monitor/state/<hash>.json]
  affects: []
tech_stack:
  added: [playwright@1.60.0]
  patterns: [atomic-state-write, frameset-navigation, xpath-table-extraction, diff-by-id-set]
key_files:
  created:
    - projudi-monitor/package.json
    - projudi-monitor/.gitignore
    - projudi-monitor/config/processes.json
    - projudi-monitor/index.js
    - projudi-monitor/package-lock.json
  modified: []
decisions:
  - Navigation uses formAcessoPublico (#codigoHash) instead of clicking a "Consulta Pública" button
  - Section heading is "Eventos do Processo" not "Etapas do Processo" (RESEARCH.md assumption A3 corrected)
  - Result loads in a child frame at /projudi/AcessoPublico, not the top-level page
  - Data rows identified by exactly 7 cells; column order [0]=nº [1]=description [2]=date [3]=movedBy
metrics:
  duration: ~90min
  completed: 2026-05-15
  tasks_completed: 2
  files_created: 5
---

# Phase 1 Plan 01: Walking Skeleton Summary

Walking skeleton for projudi-monitor: Playwright CLI that navigates Projudi TJBA via formAcessoPublico, extracts "Eventos do Processo" movimentações from the AcessoPublico frame, diffs against local JSON state, and prints new entries.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Scaffold projudi-monitor project | f2cb18b | package.json, .gitignore, config/processes.json |
| 2 | Implement walking skeleton in index.js | 4369986 | index.js, package-lock.json |

## Results

- `node projudi-monitor/index.js` ran end-to-end against live Projudi TJBA and printed 7 movimentações on first run
- `projudi-monitor/state/1d49c1c15b8c.json` written with correct `movimentacoes` array
- Second run produced no output (idempotent — DIFF-03 satisfied)
- `--dry-run` flag suppressed state write (CLI-01 satisfied)
- Browser closed cleanly — no orphaned Chromium process

## Confirmed Selectors (Live DOM Inspection 2026-05-15)

### Navigation

The Projudi homepage uses an HTML `<frameset>` structure. Main content loads into `PaginaPrincipal.jsp` frame. There is no standalone "Consulta Pública" button to click; instead the page has multiple forms in one view.

The correct form for teor hash lookup is `formAcessoPublico`:
- Form name: `formAcessoPublico`
- Input: `id="codigoHash"`, `name="codigoHash"` (type text)
- Action: `POST https://projudi.tjba.jus.br/projudi/AcessoPublico`
- Submit via: `document.formAcessoPublico.submit()` (JS evaluation in frame)

After submit, a new child frame appears at URL `/projudi/AcessoPublico` containing the DADOS DO PROCESSO page.

### Table Extraction

The section heading is **"Eventos do Processo"** (not "Etapas do Processo" as assumed in RESEARCH.md assumption A3).

Confirmed working XPath:
```javascript
// Finds the events table by heading text — returns all rows including headers
'xpath=//table[.//text()[contains(., "Eventos do Processo")]]//tr'
```

Alternative CSS selector (also works):
```css
#Arquivos table tr
```

### Column Order in Data Rows

Data rows have exactly **7 cells** in `<td>` elements (no `<th>`):

| Index | Content | Example |
|-------|---------|---------|
| 0 | Sequence number | "7" |
| 1 | Event description (multiline) | "Citação expedido(a)\nPara RODRIGO FRAGA RIBEIRO" |
| 2 | Date (DD/MM/YY) | "09/05/26" |
| 3 | Movimentado por | "VERONICA CONCEICAO BITENCOURT CERQUEIRA" |
| 4-6 | File/attachment extras | "" (usually empty) |

Non-data rows: header rows have 5-6 cells, separator rows have 1-2 cells. Filter: `cells.length === 7 AND datePattern.test(cells[2])`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Incorrect section heading assumption A3**
- **Found during:** Task 2 DOM inspection
- **Issue:** RESEARCH.md assumed section heading was "Etapas do Processo". Live DOM inspection confirmed the actual heading is "Eventos do Processo". Using the wrong heading would cause `waitForSelector` to time out on every run.
- **Fix:** Changed `waitForSelector('text=Etapas do Processo')` to `waitForSelector('text=Eventos do Processo')`, and changed XPath from `"Etapas do Processo"` to `"Eventos do Processo"`. Comment in source documents the corrected assumption.
- **Files modified:** projudi-monitor/index.js
- **Commit:** 4369986

**2. [Rule 1 - Bug] Incorrect navigation assumption A1 — no "Consulta Pública" button click**
- **Found during:** Task 2 DOM inspection
- **Issue:** RESEARCH.md documented clicking a "Consulta Pública" button (getByText or input[type=image]). Live DOM inspection revealed the homepage has a frameset with multiple forms; there is no such button element. The form for teor hash lookup is `formAcessoPublico` with `#codigoHash` input, and the result loads in a child frame — not via top-level page navigation.
- **Fix:** Replaced entire navigation flow: now fills `#codigoHash` in the PaginaPrincipal frame, submits `formAcessoPublico`, then locates the `AcessoPublico` child frame to wait for and extract content.
- **Files modified:** projudi-monitor/index.js
- **Commit:** 4369986

**3. [Rule 1 - Bug] networkidle wait strategy adjusted for frameset pages**
- **Found during:** Task 2 implementation
- **Issue:** `waitForLoadState('networkidle')` on frameset pages may never fire (frameset loads frames asynchronously). Added `.catch(() => {})` to prevent timeout errors from blocking execution.
- **Fix:** Made networkidle wait non-fatal with catch, then locate frames by URL pattern instead.
- **Files modified:** projudi-monitor/index.js
- **Commit:** 4369986

## Open Assumptions Resolved

| Assumption | Status | Outcome |
|------------|--------|---------|
| A1: "Consulta Pública" reachable via getByText | WRONG | No such button; uses formAcessoPublico |
| A2: Enter navigates to DADOS DO PROCESSO | CONFIRMED | formAcessoPublico.submit() navigates to AcessoPublico frame with process data |
| A3: Heading is "Etapas do Processo" | WRONG | Actual heading is "Eventos do Processo" |
| A4: Column order [description, date, movedBy, attachment] | CONFIRMED (adjusted) | [nº, description, date, movedBy, extras] — nº is first column |
| A7: Only one text input on teor form | CONFIRMED | #codigoHash is unique on that form |

## Known Stubs

None — all data is live from the Projudi TJBA site.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond the plan's threat model. The implementation mitigates T-01-01 (path traversal via validateCaseNumber) and T-01-02 (atomic state write). No new threats introduced.

## Self-Check: PASSED

- projudi-monitor/package.json: EXISTS
- projudi-monitor/.gitignore: EXISTS (contains "state/")
- projudi-monitor/config/processes.json: EXISTS (contains "1d49c1c15b8c")
- projudi-monitor/index.js: EXISTS (node --check passes)
- projudi-monitor/state/1d49c1c15b8c.json: EXISTS (created on first run)
- Commits f2cb18b and 4369986: VERIFIED in git log
- Second run idempotent: VERIFIED (no output)
- --dry-run no state write: VERIFIED (state dir empty after dry-run test)
