# Project State

**Current Phase:** 1
**Current Plan:** 2 of 2
**Status:** Complete — Phase 1 Core Pipeline fully implemented (21/22 v1 requirements; DOC-01 is Phase 2)

## Project Reference
See: .planning/PROJECT.md

**Core value:** Monitorar automaticamente movimentações novas em processos jurídicos no Projudi TJBA e registrá-las localmente, sem intervenção manual repetitiva.
**Current focus:** Phase 1 — Core Pipeline

## Phase History

| Phase | Status | Completed |
|-------|--------|-----------|
| 1 | Complete | 2026-05-15 |

## Decisions Made

1. Navigation uses `formAcessoPublico` (#codigoHash) — not a "Consulta Pública" button click (RESEARCH.md A1 was wrong)
2. Section heading is "Eventos do Processo" not "Etapas do Processo" (RESEARCH.md A3 was wrong)
3. Result loads in child frame at /projudi/AcessoPublico (frameset architecture)
4. Data rows identified by exactly 7 cells; column [0]=nº [1]=description [2]=date [3]=movedBy
5. Use process.exitCode (not process.exit()) so async browser.close() in finally completes before Node exits
6. Delay inserted between cases only — not after the last one — to avoid unnecessary wait at end of batch

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 01-core-pipeline | 01 | ~90min | 2/2 | 5 |
| 01-core-pipeline | 02 | ~30min | 2/2 | 1 |

## Last Session

**Timestamp:** 2026-05-15
**Stopped at:** Completed 01-02-PLAN.md (hardened pipeline — Phase 1 complete)
**Resume file:** None — Phase 2 (Documentation) next
