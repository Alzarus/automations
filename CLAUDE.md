# Automations — Project Guide

## Project

Node.js browser automation monorepo. Each automation lives in its own folder with independent dependencies. First automation: `projudi-monitor` — a Playwright-based CLI that monitors Brazilian court cases on Projudi TJBA, detects new movimentações, and prints them to the terminal.

**Planning docs:** `.planning/`
**Current phase:** Phase 1 — Core Pipeline

## GSD Workflow

This project uses GSD (Get Shit Done) for structured execution.

### Key commands

```bash
/gsd-discuss-phase 1   # Gather context before planning Phase 1
/gsd-plan-phase 1      # Create detailed PLAN.md for Phase 1
/gsd-execute-phase 1   # Execute the plan
/gsd-verify-work       # Verify phase deliverables
/gsd-progress          # Check current status
```

### Phase structure

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Core Pipeline — working monitor that detects new movimentações | Not started |
| 2 | Documentation — README for install, configure, and schedule | Not started |

## Stack

- **Runtime:** Node.js 18+ (plain JS, no TypeScript)
- **Browser automation:** Playwright `^1.60.0`
- **State persistence:** `fs/promises` + local JSON files
- **Scheduling:** OS cron / Windows Task Scheduler (external to the script)

## Monorepo conventions

- Each automation: `automations/<name>/index.js` with its own `package.json`
- No shared code between automations until duplication is proven
- State files are gitignored (`state/`)

## Key constraints

- No parallel requests to Projudi (sequential only, with delay + jitter)
- Atomic state writes only (`write to .tmp → fs.renameSync`)
- Semantic selectors only — never JSF-generated `j_id_*` IDs
- No TypeScript, no build step, no framework overhead
