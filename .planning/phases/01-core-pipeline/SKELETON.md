# Walking Skeleton — Phase 1: Core Pipeline

**Phase:** 01-core-pipeline
**Plan:** 01-01-PLAN.md (Wave 1)
**Status:** To be executed

---

## What Is This Skeleton?

The walking skeleton is the thinnest possible end-to-end implementation of the projudi-monitor pipeline. It proves that every layer of the stack connects — from reading the config file through launching Chromium, navigating Projudi TJBA, extracting movimentação rows, diffing against state, printing output, and writing atomic state files.

**One process. One run. Real site. Real output.**

---

## What the Skeleton Proves

| Layer | Claim Validated |
|-------|----------------|
| Browser launch | Playwright Chromium launches headless with AutomationDetection disabled |
| Navigation | "Consulta Pública" button is found and clicked using a semantic selector |
| JSF wait | `waitForLoadState('networkidle')` correctly waits for JSF AJAX to settle |
| Teor input | The teor hash input field is found and accepts the case hash |
| Page load confirmation | `waitForSelector('text=Etapas do Processo')` confirms correct page reached |
| Table extraction | The XPath or structural selector finds the correct table rows |
| Column mapping | Description is column 0, Date is column 1 — matches assumption A4 |
| NFC normalization | `makeId()` produces stable IDs from scraped Portuguese text |
| Diff | New movimentações are identified by Set difference on IDs |
| Output | New entries print to stdout with date and description |
| Atomic write | `writeFileSync` + `renameSync` creates valid state JSON without corruption |
| Idempotence | Second run with unchanged site produces no output |
| Browser teardown | `browser.close()` runs in finally block — no orphaned Chromium |

---

## What the Skeleton Explicitly Defers

These are NOT part of the skeleton — they are delivered in Wave 2 (Plan 01-02):

| Feature | Why Deferred |
|---------|-------------|
| Multi-process loop | Adds complexity before selectors are proven; skeleton uses only processes[0] |
| Per-case error isolation (try/catch per case) | Single-case skeleton; error isolation matters when there are multiple cases |
| Configurable delay + jitter between cases | No multiple cases in skeleton |
| Exit code 1 on any failure | Skeleton exits 0 on success, lets the main().catch handler set exitCode=1 on fatal |
| --dry-run flag (full) | State write guard is present but not fully tested across multiple runs |
| --verbose flag (full) | Verbose logs are present but full audit of coverage points is Wave 2 |
| Empty-result assertion (REL-03) | Assertion is present but not exercised by skeleton |

---

## Architectural Decisions Established by This Skeleton

These decisions are locked — subsequent plans build on them without renegotiating.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module system | CommonJS (`require`/`module.exports`) | No build step; Node.js 18+ compatible; CLAUDE.md constraint |
| Entry point | `projudi-monitor/index.js` | MONO-01 monorepo convention |
| Browser mode | Headless Chromium, new instance per run | D-01: cron compatibility, no CDP |
| User-Agent | Chrome/131.0.0.0 Windows string | Disguises headless mode from basic bot detection |
| Navigation wait strategy | `waitForLoadState('networkidle')` after JSF actions | JSF AJAX completes before network goes idle |
| Table selector strategy | XPath anchored on "Etapas do Processo" text | Stable against JSF j_id_* attribute changes |
| Movimentação ID | `NFC(date.trim()) + '|' + NFC(description.trim())` | D-06; robust against row-order changes |
| State format | `{ lastChecked: ISO8601, movimentacoes: [{id, date, description, movedBy}] }` | STATE-01 |
| State write | `writeFileSync` to `.tmp` + `renameSync` | STATE-02 atomic write; same-directory rename |
| caseNumber validation | `/^[a-f0-9]{8,}$/` before file path use | Path traversal prevention |
| Module structure | Single `index.js` with named functions | ~150-200 lines; no premature splitting |
| CLI flag parsing | `process.argv.includes('--flag')` | Two flags only; no parser library needed |

---

## How to Run the Skeleton

```bash
# 1. Install dependencies (first time only)
cd projudi-monitor
npm install
npx playwright install chromium

# 2. Verify config has the reference case
cat config/processes.json
# Expected: [{"caseNumber":"1d49c1c15b8c","label":"Processo Teste"}]

# 3. Run the skeleton (requires internet access to projudi.tjba.jus.br)
node index.js

# Expected output on first run:
# === Processo Teste ===
#   [DD/MM/YY] Descricao da movimentacao  (por: Sistema/Person)
#   [DD/MM/YY] Outra movimentacao  (por: ...)

# 4. Verify state file was written
cat state/1d49c1c15b8c.json
# Expected: { "lastChecked": "...", "movimentacoes": [...] }

# 5. Run again — should produce no output
node index.js
# (silent — idempotent)

# 6. Dry-run test
node index.js --dry-run
# Shows diff (if any) but state file mtime unchanged

# 7. Verbose mode
node index.js --verbose
# Shows [verbose] navigation steps
```

---

## Known Uncertainties at Skeleton Time

The following assumptions (from RESEARCH.md) are validated during skeleton execution. The executor MUST document the findings in `01-01-SUMMARY.md`:

| Assumption | RESEARCH.md Ref | What Executor Must Confirm |
|------------|-----------------|---------------------------|
| "Consulta Pública" button found by getByText | A1 | Which selector worked: getByText or fallback input[type="image"] |
| Teor input is first input[type="text"] on form | A7 | Whether .first() targeted the correct input |
| XPath finds Etapas table correctly | A3 | Exact DOM relationship between heading and table; selector used |
| Column order: [description, date, movedBy] | A4 | Whether innerText() from td[0], td[1], td[2] matches expected columns |

**Inspection approach:** Run once with `headless: false` and `page.pause()` inserted after `waitForSelector('text=Etapas do Processo')`. Use DevTools to inspect the DOM and confirm selector choices before switching back to headless mode.

---

## Files Created by the Skeleton

```
projudi-monitor/
├── index.js           # Entry point — orchestration, scraper, state, diff, output
├── package.json       # CommonJS project, playwright@^1.60.0 dependency
├── .gitignore         # state/, node_modules/
├── config/
│   └── processes.json # [{ "caseNumber": "1d49c1c15b8c", "label": "Processo Teste" }]
└── state/             # Created at runtime — gitignored
    └── 1d49c1c15b8c.json  # Written after first run
```

---

*Walking Skeleton defined: 2026-05-14*
*Phase: 01-core-pipeline*
*Executed by: Plan 01-01-PLAN.md*
