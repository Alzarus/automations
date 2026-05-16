# Automations

## What This Is

Um monorepo de automações utilitárias, onde cada pasta contém um script independente para um caso de uso específico. As automações podem ser de browser (Playwright/Puppeteer) ou desktop. O projeto é simples por design — cada automação resolve um problema real sem overhead desnecessário.

**Shipped:** `projudi-monitor` — Playwright CLI que monitora processos no Projudi TJBA, detecta movimentações novas desde a última checagem, e imprime no terminal. Roda manualmente ou agendado via cron/Task Scheduler.

## Core Value

Monitorar automaticamente movimentações novas em processos jurídicos no Projudi TJBA e registrá-las localmente, sem intervenção manual repetitiva.

## Requirements

### Validated

- ✓ Monorepo com cada automação em sua própria pasta — v1.0
- ✓ Automação `projudi-monitor`: consulta processos no Projudi TJBA via "consulta pública por teor" — v1.0
- ✓ Lista de processos configurável (arquivo de config) — v1.0
- ✓ Detecta movimentações novas desde a última checagem — v1.0
- ✓ Persiste estado em JSON local por processo — v1.0
- ✓ Imprime movimentações novas no terminal ao rodar — v1.0
- ✓ Suporta execução manual (`node index.js`) e agendada (cron/Task Scheduler) — v1.0

### Active

(None — start next milestone to define v1.1 requirements)

### Out of Scope

- Login autenticado no Projudi — consulta pública por teor não requer
- Notificações por WhatsApp/Telegram/e-mail — fora do escopo inicial (v2 candidato: `automations/notifier/`)
- Interface gráfica — CLI é suficiente
- Outros tribunais além do TJBA — pode ser adicionado depois como pasta separada
- Execução paralela de processos — risco de rate limiting/IP block

## Context

- Shipped v1.0 with ~270 LOC JavaScript (`projudi-monitor/index.js`)
- Tech stack: Node.js 18+, Playwright ^1.60.0, fs/promises + JSON state files
- Site alvo: https://projudi.tjba.jus.br/projudi/ — acesso via frameset, without login or CAPTCHA
- Frameset architecture: results load in child frame at `/projudi/AcessoPublico`
- State: `state/<caseNumber>.json` per process — atomic writes via `.tmp` + `fs.renameSync`
- No known issues in production — 5/5 UAT tests passed, 7 real movimentações scraped successfully

## Constraints

- **Simplicidade**: Código direto, sem frameworks, sem ORM, sem over-engineering
- **Stack**: Node.js + Playwright (sem TypeScript por ora — JS puro é suficiente)
- **Sem banco de dados**: Tudo em arquivos JSON locais
- **Sem paralelismo**: Requests ao Projudi são estritamente sequenciais (delay + jitter)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Playwright (não Puppeteer) | API mais limpa, suporte nativo a múltiplos browsers, melhor manutenção | ✓ Good — frameset navigation worked cleanly |
| JS puro (não TypeScript) | Reduz complexidade de setup para scripts utilitários simples | ✓ Good — zero build overhead |
| JSON local (não banco) | Zero dependências externas, portabilidade total | ✓ Good — atomic writes prevent corruption |
| formAcessoPublico (#codigoHash) | No "Consulta Pública" button exists; frameset form is the correct entry point | ✓ Good — caught early in live DOM inspection |
| "Eventos do Processo" heading | RESEARCH.md assumed "Etapas do Processo" — live DOM corrected this | ✓ Good — corrected before first commit |
| process.exitCode (não process.exit()) | Allows async browser.close() in finally to complete before Node exits | ✓ Good — no orphaned Chromium processes |
| Delay only between cases | No trailing delay after last case — avoids unnecessary wait at end of batch | ✓ Good — clean UX for single-case config |
| README from source of truth | All flags, exit codes, and field names verified against index.js before documenting | ✓ Good — no doc drift on first release |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-16 after v1.0 milestone*
