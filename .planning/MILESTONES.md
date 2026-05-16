# Milestones

## v1.0 MVP — Shipped 2026-05-16

**Phases:** 1-2 | **Plans:** 3 | **Duration:** 5 days

**Delivered:** Playwright CLI that monitors Projudi TJBA court cases, detects new movimentações since the last run, and prints them to the terminal — fully documented, tested, and schedulable via cron or Task Scheduler.

**Key accomplishments:**
- Playwright CLI navigates Projudi TJBA via `formAcessoPublico` (frameset architecture), extracts "Eventos do Processo" movimentações from the `AcessoPublico` child frame, diffs against local JSON state, and prints new entries
- Multi-case sequential pipeline hardened: per-case error isolation, BASE_DELAY_MS + jitter, `process.exitCode` semantics, `browser.close()` guaranteed via `try/finally`
- Complete user guide covering install, config, cron (Linux), Task Scheduler (Windows), `--dry-run`/`--verbose` flags, exit codes, and 5-row troubleshooting table

**Stats:** 14 files, 1,634 LOC (net), 5/5 UAT tests passed, 22/22 v1 requirements

**Archives:**
- `.planning/milestones/v1.0-ROADMAP.md`
- `.planning/milestones/v1.0-REQUIREMENTS.md`
