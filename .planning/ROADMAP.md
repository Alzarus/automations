# Roadmap: Automations / Projudi Monitor

## Overview

Node.js browser automation monorepo. First automation: `projudi-monitor`, a Playwright-based CLI tool that queries the Projudi TJBA public court search, detects new movimentacoes since the last run, and prints them to stdout — persisting state locally in JSON files. Coarse granularity, MVP mode: two phases deliver a complete, usable tool.

## Phases

- [ ] **Phase 1: Core Pipeline** - Working monitor that detects new court movimentacoes and fails loudly on error
- [ ] **Phase 2: Documentation** - README that lets a new user install, configure, and schedule the monitor without asking questions

---

## Phase Details

### Phase 1: Core Pipeline
**Goal:** A user running `node index.js` gets new court movimentacoes printed to the terminal, with state persisted so the next run only shows truly new entries.
**Mode:** mvp
**Requirements:** MONO-01, CFG-01, CFG-02, SCRP-01, SCRP-02, SCRP-03, PARS-01, PARS-02, PARS-03, STATE-01, STATE-02, STATE-03, DIFF-01, DIFF-02, DIFF-03, DIFF-04, REL-01, REL-02, REL-03, CLI-01, CLI-02
**Success Criteria:**
1. Running `node index.js` against a real Projudi case number prints any new movimentacoes grouped by process, or produces no output if nothing changed since the last run.
2. Running the script twice in a row without actual court updates produces identical output (idempotent — no false positives on second run).
3. A broken or unreachable case number logs an error for that case and continues processing the remaining cases; the script exits with code 1 only when at least one case failed.
4. Running with `--dry-run` shows the diff but leaves state files unchanged; `--verbose` emits navigation and timing details to stdout.
**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Walking Skeleton: scaffold project, navigate Projudi, extract movimentacoes, diff, print, save state (Wave 1)
- [ ] 01-02-PLAN.md — Harden Pipeline: multi-process loop, error isolation, exit codes, full CLI flags, empty-result assertion (Wave 2)

### Phase 2: Documentation
**Goal:** A user with no prior knowledge of the project can install, configure a process list, run the monitor manually, and set up a scheduled job by following the README alone.
**Mode:** mvp
**Requirements:** DOC-01
**Success Criteria:**
1. A user following the README from scratch can install dependencies, populate `config/processes.json`, and execute `node index.js` successfully without consulting external resources.
2. The README provides copy-paste cron (Linux) and Task Scheduler (Windows) instructions that schedule the monitor to run automatically.
**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Pipeline | 0/2 | Not started | - |
| 2. Documentation | 0/1 | Not started | - |
