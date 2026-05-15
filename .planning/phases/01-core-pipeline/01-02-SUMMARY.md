---
phase: 01-core-pipeline
plan: 02
subsystem: projudi-monitor
tags: [playwright, scraping, multi-case, error-isolation, cli-flags, exit-codes]
dependency_graph:
  requires: [01-01]
  provides: [projudi-monitor/index.js (hardened pipeline)]
  affects: []
tech_stack:
  added: []
  patterns: [sequential-loop-with-jitter, per-case-error-isolation, process-exitcode-pattern, try-finally-browser-lifecycle]
key_files:
  created: []
  modified:
    - projudi-monitor/index.js
decisions:
  - Use process.exitCode (not process.exit()) so async browser.close() in finally can complete before Node exits
  - Delay inserted between cases only (not after the last case) to avoid unnecessary wait at end of batch
  - BASE_DELAY_MS=3000 + random jitter up to JITTER_MS=2000 per CLAUDE.md sequential-only constraint
  - REL-03 error message uses ASCII 'movimentacao' (no accent) for reliable pattern matching in tooling
metrics:
  duration: ~30min
  completed: 2026-05-15
  tasks_completed: 2
  files_created: 0
  files_modified: 1
---

# Phase 1 Plan 02: Harden Pipeline Summary

Multi-case sequential pipeline hardened into production-ready state: for-of loop with per-case error isolation, BASE_DELAY_MS+JITTER_MS between requests, process.exitCode semantics, and browser.close() guaranteed via try/finally.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add multi-process loop, error isolation, and exit codes | f4f96d4 | projudi-monitor/index.js |
| 2 | Wire --dry-run and --verbose flags fully, add empty-result assertion | f4f96d4 | projudi-monitor/index.js |

## Verification Results

### Syntax Check

```
node --check projudi-monitor/index.js
# Exit: 0 — Syntax OK
```

### Pattern Checks (automated)

All required patterns present in source:
- `hadFailure` — per-batch failure tracker
- `BASE_DELAY_MS` — 3000ms base delay constant
- `JITTER_MS` — 2000ms max jitter constant
- `for (const proc of` — sequential loop
- `process.exitCode` — correct exit code mechanism
- `finally` — browser lifecycle guarantee
- `browser.close()` — inside finally block
- `--dry-run` / `--verbose` — CLI flag strings
- `[verbose]` — verbose log prefix
- `dryRun` — flag guard in processCase
- `movimentacoes.length === 0` — REL-03 empty assertion
- `No movimentacao rows found` — REL-03 error message

Prohibited patterns NOT present:
- `process.exit(` — confirmed absent (only in comments)
- `Promise.all` — confirmed absent (no parallel scraping)

## Requirements Satisfied

| Requirement | Description | Evidence |
|-------------|-------------|---------|
| CFG-02 | Delay entre consultas configurável | BASE_DELAY_MS=3000 + Math.random()*JITTER_MS=2000 between cases |
| SCRP-02 | Múltiplos processos em sequência (não paralelo) | for-of loop, no Promise.all, delay between cases |
| DIFF-04 | Exit code 0 = sucesso total; 1 = ao menos um falhou | process.exitCode = hadFailure ? 1 : 0 after loop |
| REL-01 | Erro em um processo não para o batch | per-case try/catch, console.error('[ERROR]'), hadFailure=true, continues |
| REL-02 | try/finally garante browser.close() | outer try/finally wraps entire browser session |
| REL-03 | Assertiva de resultado não vazio | movimentacoes.length === 0 throws before saveState |
| CLI-01 | --dry-run suprime writes | if (!flags.dryRun) guard on saveState, diff still computed |
| CLI-02 | --verbose output de debug | [verbose] logs at: navigate, frame found, codigoHash filled, AcessoPublico frame, Eventos section, raw rows, extracted count, diff count, state saved/skipped, processing case, waiting delay |

## All Phase 1 Requirements Status

| Requirement | Status |
|-------------|--------|
| MONO-01 | Complete (01-01) |
| CFG-01 | Complete (01-01) |
| CFG-02 | Complete (01-02) |
| SCRP-01 | Complete (01-01) |
| SCRP-02 | Complete (01-02) |
| SCRP-03 | Complete (01-01) |
| PARS-01 | Complete (01-01) |
| PARS-02 | Complete (01-01) |
| PARS-03 | Complete (01-01) |
| STATE-01 | Complete (01-01) |
| STATE-02 | Complete (01-01) |
| STATE-03 | Complete (01-01) |
| DIFF-01 | Complete (01-01) |
| DIFF-02 | Complete (01-01) |
| DIFF-03 | Complete (01-01) |
| DIFF-04 | Complete (01-02) |
| REL-01 | Complete (01-02) |
| REL-02 | Complete (01-01 + 01-02 hardened) |
| REL-03 | Complete (01-01 + 01-02 message fixed) |
| CLI-01 | Complete (01-01 + 01-02 verified) |
| CLI-02 | Complete (01-01 + 01-02 expanded) |
| DOC-01 | Pending (Phase 2) |

21 of 22 v1 requirements complete. DOC-01 is Phase 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] REL-03 error message used accented character**
- **Found during:** Task 2 verification
- **Issue:** Plan 01-01 implemented REL-03 with message `'No movimentação rows found for ...'` (with accent). The plan 01-02 acceptance criteria and automated checks search for `'No movimentacao rows found'` (ASCII, no accent). Mismatch caused verification failure.
- **Fix:** Changed error message string from `movimentação` to `movimentacao` (ASCII). Semantically identical; the accented form appears only in log output context.
- **Files modified:** projudi-monitor/index.js
- **Commit:** f4f96d4

### Notes on Tasks 1 and 2

Tasks 1 and 2 were committed together (f4f96d4) because Task 2 was primarily a verification/audit task — it confirmed that `--dry-run`, `--verbose`, and REL-03 were already implemented in the correct structure from Plan 01-01, and only required the REL-03 message fix and expansion of verbose log coverage.

## Known Stubs

None — all data is live from Projudi TJBA. No hardcoded placeholders or mock data.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes. The multi-case loop does not introduce new trust boundaries beyond what was analyzed in the plan's threat model. T-02-01 (per-case isolation) and T-02-02 (browser.close guarantee) are both implemented. T-02-03 (delay between cases) is satisfied by BASE_DELAY_MS + JITTER_MS.

## Self-Check: PASSED

- projudi-monitor/index.js: EXISTS, syntax OK (node --check passes)
- Commit f4f96d4: VERIFIED in git log
- All required patterns present in source
- All prohibited patterns absent from source
- 21 of 22 Phase 1 v1 requirements complete
