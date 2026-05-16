# Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-05-16
**Phases:** 2 | **Plans:** 3

### What Was Built

- Playwright CLI that navigates Projudi TJBA's frameset architecture via `formAcessoPublico`, extracts "Eventos do Processo" movimentações from the `AcessoPublico` child frame, diffs against local JSON state, and prints new entries
- Multi-case sequential pipeline with per-case error isolation, jitter delay, `process.exitCode` semantics, and guaranteed browser cleanup via `try/finally`
- Complete README covering install, config, cron (Linux), Task Scheduler (Windows), CLI flags, and troubleshooting

### What Worked

- **Live DOM inspection early** — both RESEARCH.md navigation assumptions (A1, A3) were wrong; catching this during Task 2 DOM inspection rather than after multiple bad commits saved significant rework
- **Walking skeleton approach** — shipping a runnable end-to-end script first (01-01) then hardening (01-02) kept scope clear and made verification mechanical
- **Source-of-truth anchoring for docs** — writing the README by reading `index.js` line-by-line prevented doc drift entirely on first release
- **Atomic state writes from the start** — `.tmp` + `fs.renameSync` was a non-negotiable constraint that paid off immediately in the idempotence test

### What Was Inefficient

- RESEARCH.md assumptions were speculative and two of five navigational assumptions were wrong — less upfront research speculation, more "scaffold and look" would have been faster for a site with no public docs
- Phase 2 (docs) had no CONTEXT.md — the `--skip-research` path worked fine, but the discuss step could have been dropped entirely for a bounded "write README from existing code" task

### Patterns Established

- **Frameset navigation**: fill `#codigoHash` in the `PaginaPrincipal` frame → `formAcessoPublico.submit()` → locate `AcessoPublico` child frame by URL → wait for heading text
- **7-cell row filter**: data rows have exactly 7 `<td>` cells; filter `cells.length === 7 AND datePattern.test(cells[2])` to exclude header/separator rows
- **process.exitCode pattern**: set `process.exitCode = hadFailure ? 1 : 0` at end of loop — do not use `process.exit()` which kills async cleanup
- **Delay only between cases**: skip trailing delay after the last case to avoid unnecessary wait at end of batch

### Key Lessons

- JSF-generated site assumptions are unreliable without live inspection — always verify selectors against the real DOM before planning extraction logic
- For small utility scripts, the walking skeleton phase should be short (~90min max) and the hardening phase even shorter — scope creep risk is low when the target is well-defined
- README written at milestone close from source code is more accurate than README written during planning from spec — write docs last

### Cost Observations

- Sessions: 2 (one for Phase 1, one for Phase 2 + milestone)
- Notable: Phase 2 documentation took ~10 min (bounded task, no ambiguity)

---

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Duration (days) | 5 |
| Phases | 2 |
| Plans | 3 |
| LOC (net) | 1,634 |
| UAT pass rate | 5/5 (100%) |
| Requirements hit | 22/22 (100%) |
| Research accuracy | 3/5 assumptions correct |
