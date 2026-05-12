# Research Summary: Automations Monorepo / Projudi Monitor

**Synthesized:** 2026-05-11
**Overall confidence:** HIGH for architecture and features; MEDIUM for Projudi-specific behavior (unverifiable without live access)

---

## Recommended Stack

- **Playwright `^1.60.0`** — browser automation; multi-browser support (Firefox fallback se Chromium for fingerprinted), API estável, manutenção ativa. Puppeteer descartado.
- **`fs/promises` (Node built-in, Node 18+)** — JSON state; sem biblioteca externa. Atomic writes via write-to-temp + `fs.renameSync`.
- **Flat folder convention** — cada automação é uma pasta independente com seu próprio `package.json`. Sem Turborepo/Nx.
- **OS cron / Task Scheduler** — scheduler preferido; sem processo Node persistente. `node-cron ^4.2.1` como fallback.

**Excluídos explicitamente:** Puppeteer, Cheerio+axios, playwright-extra stealth (stale desde 2023), TypeScript, lowdb/conf, qualquer banco de dados.

---

## Table Stakes Features

- `config/processes.json` — lista configurável de números de processo
- Navegação Playwright + submissão de formulário no Projudi "consulta por teor"
- Parser HTML → movimentacoes estruturadas: `{ id, date, description }` (id = chave composta NFC-normalizada)
- State file por processo: `state/<caseNumber>.json` com `{ lastChecked, movimentacoes: [] }`
- Diff detection — compara fresh vs stored; reporta só entradas novas
- Output stdout humanamente legível; exit code 0 = sucesso, 1 = ao menos um caso falhou
- Erro por caso não para o batch (graceful per-case error handling)
- Idempotência — segunda execução sem novidades não gera ruído
- Delay configurável entre casos (padrão: 3000ms + jitter aleatório 0–2000ms)
- Flags `--dry-run` e `--verbose`
- `try/finally` com `browser.close()` — previne processos Chromium órfãos no Windows

---

## Architecture at a Glance

```
automations/
├── projudi-monitor/
│   ├── index.js                  # Orquestra o pipeline completo
│   ├── package.json
│   ├── config/
│   │   └── processes.json        # [{ caseNumber, label? }]
│   ├── state/                    # Gitignored; um .json por processo
│   └── src/
│       ├── configLoader.js       # Lê e valida processes.json
│       ├── browser.js            # Launch/teardown Playwright; UA realista
│       ├── scraper.js            # Navega Projudi, preenche formulário, retorna dados brutos
│       ├── parser.js             # Extrai movimentacoes; normaliza NFC; ID composto
│       ├── stateManager.js       # loadState / saveState com atomic write
│       ├── diffDetector.js       # detectNew(fresh, stored) — lógica pura
│       └── reporter.js           # Formata e printa no stdout
└── <next-automation>/
```

**Pipeline:** `loadConfig → launchBrowser → for each case: scrape → parse → loadState → detectNew → report → saveState → closeBrowser`

**Build order:** configLoader + stateManager → browser + scraper (headed, live site) → parser → diffDetector → reporter → integração em index.js

---

## Top Pitfalls to Avoid

| # | Pitfall | Consequência | Prevenção |
|---|---------|-------------|-----------|
| 1 | **Selector rot (JSF dynamic IDs)** | Scraper retorna vazio silenciosamente | Usar `getByText`, `locator` semântico — jamais `j_id_*` |
| 2 | **State file corruption em write interrompido** | JSON.parse quebra; toda história vira "nova" | Write para `.tmp` → `fs.renameSync` atômico |
| 3 | **Headless fingerprinting** | Site retorna vazio com HTTP 200 | `--disable-blink-features=AutomationControlled`, UA realista, assertar container não-vazio |
| 4 | **Rate limiting em requisições rápidas** | Casos do meio da lista retornam vazio silenciosamente | Sequential only; 3s + jitter; retry com backoff |
| 5 | **Processos Chromium órfãos no Windows** | RAM cresce a cada execução falha | `try/finally` sempre chama `browser.close()`; handlers SIGTERM/SIGINT |

**Também:** Encoding (Projudi pode servir ISO-8859-1 — verificar `document.characterSet`; normalizar com `str.normalize('NFC').trim()`).

---

## Key Decisions for Roadmap

1. **Fase 1 inclui toda infraestrutura de confiabilidade** — atomic writes, semantic selectors, headless config, per-case error handling são requisitos de corretude.
2. **Validar DOM do Projudi antes de escrever o parser** — Step browser+scraper (modo headed, site ao vivo) deve completar antes do parser começar.
3. **Delay entre casos é arquitetura, não configuração** — pertence ao loop desde a primeira versão.
4. **Estratégia de chave de deduplicação decide no momento do parser** — bloqueia o schema do state file.
5. **Fase 2 é cron + hardening operacional** — SIGTERM/SIGINT handlers, timeout, limpeza prévia no Windows.
6. **Sem biblioteca compartilhada até duplicação ser provada** — nova automação começa do zero; extrair `shared/` só se dois scripts resolverem o mesmo problema de forma similar.

---

## Suggested Phase Structure

**Fase 1 — Core pipeline + reliability infrastructure**
Entrega: monitor funcionando e idempotente que detecta movimentações novas e falha de forma barulhenta quando algo dá errado.

**Fase 2 — Cron integration + operational hardening**
Entrega: execução agendada autônoma no Windows Task Scheduler ou cron do Linux.

**Fase 3 (deferred)** — Notification hooks como pasta de automação separada.
