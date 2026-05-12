# Automations

## What This Is

Um monorepo de automações utilitárias, onde cada pasta contém um script independente para um caso de uso específico. As automações podem ser de browser (Playwright/Puppeteer) ou desktop. O projeto é simples por design — cada automação resolve um problema real sem overhead desnecessário.

## Core Value

Monitorar automaticamente movimentações novas em processos jurídicos no Projudi TJBA e registrá-las localmente, sem intervenção manual repetitiva.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Monorepo com cada automação em sua própria pasta
- [ ] Automação `projudi-monitor`: consulta processos no Projudi TJBA via "consulta pública por teor"
- [ ] Lista de processos configurável (arquivo de config)
- [ ] Detecta movimentações novas desde a última checagem
- [ ] Persiste estado em JSON local por processo
- [ ] Imprime movimentações novas no terminal ao rodar
- [ ] Suporta execução manual (`node index.js`) e agendada (cron)

### Out of Scope

- Login autenticado no Projudi — consulta pública por teor não requer
- Notificações por WhatsApp/Telegram/e-mail — fora do escopo inicial
- Interface gráfica — CLI é suficiente
- Outros tribunais além do TJBA — pode ser adicionado depois como pasta separada

## Context

- Site alvo: https://projudi.tjba.jus.br/projudi/
- Acesso via "consulta pública por teor" — sem login, sem CAPTCHA
- Ferramenta de browser: Playwright (preferência por ser mais moderno e robusto)
- Processos a monitorar ficam num arquivo de config (ex: `processes.json`)
- Estado de cada processo salvo em `state/<numero>.json` com data da última checagem e movimentações conhecidas
- Execução agendada via cron do sistema operacional ou node-cron

## Constraints

- **Simplicidade**: Código direto, sem frameworks, sem ORM, sem over-engineering
- **Stack**: Node.js + Playwright (sem TypeScript por ora — JS puro é suficiente)
- **Sem banco de dados**: Tudo em arquivos JSON locais

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Playwright (não Puppeteer) | API mais limpa, suporte nativo a múltiplos browsers, melhor manutenção | — Pending |
| JS puro (não TypeScript) | Reduz complexidade de setup para scripts utilitários simples | — Pending |
| JSON local (não banco) | Zero dependências externas, portabilidade total | — Pending |

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
*Last updated: 2026-05-11 after initialization*
