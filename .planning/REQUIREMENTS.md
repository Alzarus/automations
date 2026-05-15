# Requirements: Automations / Projudi Monitor

**Defined:** 2026-05-11
**Core Value:** Monitorar automaticamente movimentações novas em processos jurídicos no Projudi TJBA e registrá-las localmente, sem intervenção manual repetitiva.

## v1 Requirements

### Monorepo Structure

- [x] **MONO-01**: Projeto organizado em `automations/<nome>/` — cada automação é uma pasta independente com seu próprio `package.json`

### Configuration

- [x] **CFG-01**: Lista de processos configurável em `config/processes.json` com campo `caseNumber` (e `label` opcional)
- [x] **CFG-02**: Delay entre consultas configurável (padrão: 3000ms + jitter aleatório)

### Scraping

- [x] **SCRP-01**: Script navega no Projudi TJBA via "consulta pública por teor" sem login nem CAPTCHA
- [x] **SCRP-02**: Suporta múltiplos processos em sequência (não paralelo)
- [x] **SCRP-03**: Browser roda com User-Agent realista e sem sinalização de automação (`--disable-blink-features=AutomationControlled`)

### Parsing

- [x] **PARS-01**: Extrai movimentações do DOM com seletores semânticos (sem IDs JSF dinâmicos)
- [x] **PARS-02**: Cada movimentação tem: `date`, `description`, `id` (chave composta NFC-normalizada)
- [x] **PARS-03**: Strings normalizadas com `NFC` + `trim()` antes de qualquer comparação

### State Management

- [x] **STATE-01**: State persistido em `state/<caseNumber>.json` por processo com `{ lastChecked, movimentacoes: [] }`
- [x] **STATE-02**: Writes atômicos via write-para-`.tmp` + `fs.renameSync` (previne corrupção em crash)
- [x] **STATE-03**: Pasta `state/` adicionada ao `.gitignore`

### Diff & Output

- [x] **DIFF-01**: Detecta movimentações novas comparando fresh vs stored por ID
- [x] **DIFF-02**: Imprime movimentações novas no terminal agrupadas por processo
- [x] **DIFF-03**: Sem saída se não há novidades (idempotente)
- [x] **DIFF-04**: Exit code 0 = sucesso total; exit code 1 = ao menos um processo falhou

### Reliability

- [x] **REL-01**: Erro em um processo não para o batch — log do erro e continua para o próximo
- [x] **REL-02**: `try/finally` garante `browser.close()` sempre executa (sem Chromium órfão no Windows)
- [x] **REL-03**: Assertiva de que o container de resultados não está vazio (detecta scrape silenciosamente vazio)

### CLI Flags

- [x] **CLI-01**: Flag `--dry-run` — consulta e mostra diff, mas não salva state
- [x] **CLI-02**: Flag `--verbose` — output adicional de debug (navegação, seletores, timing)

### Documentation

- [ ] **DOC-01**: README em `projudi-monitor/` com: instalação, configuração do `processes.json`, como rodar manualmente, como configurar cron (Linux) e Task Scheduler (Windows)

## v2 Requirements

### Operational Hardening

- **HARD-01**: Handlers SIGTERM/SIGINT para fechamento limpo do browser
- **HARD-02**: Timeout máximo por execução
- **HARD-03**: Log file por execução em `logs/<date>.log`
- **HARD-04**: Backup automático de state files antes de sobrescrever

### CLI Extras

- **CLI-03**: Flag `--case <numero>` para consulta avulsa sem alterar outros processos

### Notificações

- **NOTF-01**: Automação separada (`automations/notifier/`) para alertas por mensagem quando o state mudar

## Out of Scope

| Feature | Reason |
|---------|--------|
| Login autenticado no Projudi | Consulta pública por teor não requer; adiciona complexidade e sessão para gerenciar |
| Execução paralela de processos | Risco de rate limiting/IP block em infra governamental |
| Outros tribunais (TJSP, PJe, etc.) | Nova pasta de automação futura; não misturar com projudi-monitor |
| Interface gráfica / dashboard | Over-engineering para uma ferramenta CLI utilitária |
| TypeScript | Overhead de build desnecessário para scripts simples |
| Banco de dados | JSON local é suficiente e portátil |
| node-cron embutido | OS scheduler é mais simples e robusto; documentar configuração basta |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MONO-01 | Phase 1 | Complete (01-01) |
| CFG-01 | Phase 1 | Complete (01-01) |
| CFG-02 | Phase 1 | Complete (01-02) |
| SCRP-01 | Phase 1 | Complete (01-01) |
| SCRP-02 | Phase 1 | Complete (01-02) |
| SCRP-03 | Phase 1 | Complete (01-01) |
| PARS-01 | Phase 1 | Complete (01-01) |
| PARS-02 | Phase 1 | Complete (01-01) |
| PARS-03 | Phase 1 | Complete (01-01) |
| STATE-01 | Phase 1 | Complete (01-01) |
| STATE-02 | Phase 1 | Complete (01-01) |
| STATE-03 | Phase 1 | Complete (01-01) |
| DIFF-01 | Phase 1 | Complete (01-01) |
| DIFF-02 | Phase 1 | Complete (01-01) |
| DIFF-03 | Phase 1 | Complete (01-01) |
| DIFF-04 | Phase 1 | Complete (01-02) |
| REL-01 | Phase 1 | Complete (01-02) |
| REL-02 | Phase 1 | Complete (01-01) |
| REL-03 | Phase 1 | Complete (01-01) |
| CLI-01 | Phase 1 | Complete (01-01) |
| CLI-02 | Phase 1 | Complete (01-01) |
| DOC-01 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-11*
*Last updated: 2026-05-11 after roadmap creation*
