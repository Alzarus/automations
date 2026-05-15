# Phase 1: Core Pipeline - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver `projudi-monitor/index.js` — a Node.js CLI that reads a list of case teor hashes from `config/processes.json`, navigates Projudi TJBA via headless Chromium (Playwright), extracts movimentações from each process page, compares them against persisted state, and prints any new ones to the terminal. State is stored in `state/<teor-hash>.json` per process. The script runs to completion and exits.

</domain>

<decisions>
## Implementation Decisions

### Browser Mode
- **D-01:** Launch a new headless Chromium instance per run (Playwright's own Chromium). Do NOT connect to an existing Chrome session via CDP. No headed mode — fully headless for cron compatibility.

### Projudi Navigation Flow
- **D-02:** Entry URL is `https://projudi.tjba.jus.br/projudi/`. From there, click the "Consulta Pública" button (red button — use semantic text selector, never JSF-generated ID).
- **D-03:** After clicking, fill the teor search field with the case's teor hash (e.g., `1d49c1c15b8c`) and press Enter. This navigates directly to the "DADOS DO PROCESSO" page — no intermediate page or result list.
- **D-04:** Movimentações are extracted from the "Etapas do Processo" table on the process page. Each row is one movimentação, with columns: description, date (DD/MM/YY), "Movimentado por", "Arquivo/Observação".

### Case Identifier Format
- **D-05:** The `caseNumber` in `config/processes.json` is the teor hash (e.g., `1d49c1c15b8c`), NOT the CNJ process number. State files are named `state/<teor-hash>.json`.

### Movimentação ID (Deduplication Key)
- **D-06:** Each movimentação's unique ID is a composite of **date + description**, both NFC-normalized and trimmed before concatenation. This is robust against row-order changes. Stored in the `id` field of each movimentação object.

### Claude's Discretion
- Terminal output format (how new movimentações are printed — labels, separators, timestamps): planner chooses a clean, readable format
- Internal code structure (single `index.js` vs. separate modules for scraper/state/diff): planner decides based on simplicity and CLAUDE.md guidelines
- Exact selector strings for "Etapas do Processo" table rows: researcher identifies robust semantic selectors from Projudi's DOM

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — All v1 requirements with IDs (MONO-01, CFG-01/02, SCRP-01/02/03, PARS-01/02/03, STATE-01/02/03, DIFF-01/02/03/04, REL-01/02/03, CLI-01/02). Phase 1 covers all except DOC-01.

### Target Site
- `projudi.md` — Projudi TJBA URL and teor hash example (`1d49c1c15b8c`). Researcher should inspect the live DOM to identify stable semantic selectors for the "Consulta Pública" button, teor input field, and "Etapas do Processo" table.

### Project Constraints
- `CLAUDE.md` — Stack constraints (Node.js plain JS, no TypeScript), monorepo conventions, key constraints (no parallel requests, atomic state writes, semantic selectors only).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — fresh project, no existing code.

### Established Patterns
- None yet — this phase establishes the baseline patterns for the monorepo.

### Integration Points
- Entry point: `projudi-monitor/index.js` (per MONO-01)
- Config: `projudi-monitor/config/processes.json`
- State: `projudi-monitor/state/<teor-hash>.json` (gitignored per STATE-03)

</code_context>

<specifics>
## Specific Ideas

- The teor hash example from `projudi.md`: `1d49c1c15b8c` — use this as the reference case for testing during implementation.
- The "Etapas do Processo" table is visible in the second screenshot (2026-05-14_22h56_05.png): rows include description, date in DD/MM/YY format, "Movimentado por" column.
- The site uses JSF with dynamic `j_id_*` IDs — all selectors must be semantic (text, role, aria, or stable class names — never `j_id_*`).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Core Pipeline*
*Context gathered: 2026-05-14*
