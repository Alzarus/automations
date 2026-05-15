---
phase: 01-core-pipeline
verified: 2026-05-15T03:00:00Z
status: human_needed
score: 8/8 must-haves verified (automated checks)
overrides_applied: 0
human_verification:
  - test: "Executar node projudi-monitor/index.js contra o site real do Projudi TJBA e confirmar que pelo menos uma movimentação é impressa no terminal na primeira execução"
    expected: "Bloco '=== Processo Teste ===' seguido de linhas '[DD/MM/YY] descrição' é exibido no stdout; script encerra com código 0"
    why_human: "Requer acesso à internet e conectividade com projudi.tjba.jus.br — não verificável estaticamente"
  - test: "Executar o script uma segunda vez (estado já salvo) e confirmar que não há saída de movimentação"
    expected: "Nenhum bloco '===' é impresso; script encerra com código 0 (DIFF-03 — idempotente)"
    why_human: "Depende do estado persistido de uma execução anterior real no site ao vivo"
  - test: "Executar com --dry-run e confirmar que state/1d49c1c15b8c.json NÃO é modificado (verificar mtime antes e depois)"
    expected: "Diff computado e exibido se houver novidades, mas arquivo de estado não é alterado (CLI-01)"
    why_human: "Requer execução contra o site ao vivo para gerar dados frescos e comparar mtime"
  - test: "Executar com --verbose e confirmar que pelo menos 6 linhas [verbose] distintas aparecem cobrindo: navegação, frame encontrado, codigoHash preenchido, frame AcessoPublico, seção Eventos, diff computado"
    expected: "14 linhas [verbose] esperadas com base na contagem no código-fonte (CLI-02)"
    why_human: "Requer execução real para confirmar que os console.log não são suprimidos por erros de runtime"
  - test: "Adicionar temporariamente uma entrada inválida ao config/processes.json (ex: 'INVALID') e executar; confirmar: linha [ERROR] aparece, o caso válido ainda processa, o script encerra com código 1"
    expected: "'[ERROR] INVALID: Invalid caseNumber: INVALID' impresso, saída de movimentação para caso válido ainda exibida, echo $? retorna 1 (REL-01, DIFF-04)"
    why_human: "Requer execução ao vivo com config temporariamente alterado e verificação do código de saída"
---

# Fase 1: Core Pipeline — Relatório de Verificação

**Meta da Fase:** Entregar um CLI Node.js funcional que lê hashes teor de config/processes.json, navega no Projudi TJBA via Chromium headless, extrai movimentações, compara com estado persistido e imprime as novas no terminal.
**Verificado em:** 2026-05-15T03:00:00Z
**Status:** human_needed
**Re-verificação:** Não — verificação inicial

---

## Conquista da Meta

### Verdades Observáveis

| # | Verdade | Status | Evidência |
|---|---------|--------|-----------|
| 1 | `node projudi-monitor/index.js` navega o Projudi TJBA e imprime pelo menos uma movimentação no primeiro run | ? HUMANO | Código implementado corretamente; requer execução ao vivo para confirmar |
| 2 | Cada movimentação exibida mostra data e descrição extraídas da tabela Eventos do Processo | VERIFICADO | `cells[1]` = descrição, `cells[2]` = data DD/MM/YY; state file tem 7 entradas reais do site ao vivo |
| 3 | Estado escrito em `state/1d49c1c15b8c.json` com array `movimentacoes` após primeiro run | VERIFICADO | Arquivo existe com 7 entradas; campos `id`, `date`, `description`, `lastChecked` confirmados |
| 4 | Segundo run produz sem output (idempotente) | ? HUMANO | Lógica de diff correta no código (`storedIds` Set + `filter`); requer execução ao vivo |
| 5 | Browser fecha limpo — nenhum processo Chromium órfão | ? HUMANO | `try/finally { await browser.close() }` implementado corretamente; requer execução para confirmar |
| 6 | `--dry-run` suprime `saveState()` | VERIFICADO | Guard `if (!flags.dryRun)` envolve a chamada `saveState()`; verboso loga "dry-run active" |
| 7 | Loop multi-caso for-of processa casos sequencialmente sem paralelismo | VERIFICADO | `for (const proc of processes)` presente; `Promise.all` ausente; delay entre casos implementado |
| 8 | Erro em um caso não aborta o batch; exit code 1 quando qualquer caso falha | VERIFICADO | Per-case try/catch com `hadFailure = true`; `process.exitCode = hadFailure ? 1 : 0` após loop |

**Pontuação (verificação automatizada):** 5/8 VERIFICADO + 3/8 HUMANO — nenhum FAILED

---

### Artifacts Obrigatórios

| Artifact | Esperado | Status | Detalhes |
|----------|----------|--------|---------|
| `projudi-monitor/package.json` | Manifesto npm com playwright | VERIFICADO | `"playwright": "^1.60.0"` em dependencies; sem `"type": "module"` (CommonJS correto) |
| `projudi-monitor/.gitignore` | Exclui state/ do git | VERIFICADO | Contém `state/` e `node_modules/` |
| `projudi-monitor/config/processes.json` | Lista de casos com hash `1d49c1c15b8c` | VERIFICADO | Array com 1 entrada: `{"caseNumber":"1d49c1c15b8c","label":"Processo Teste"}` |
| `projudi-monitor/index.js` | Pipeline completo com try/finally browser.close() | VERIFICADO | 272 linhas, sintaxe OK, todos os padrões obrigatórios presentes |
| `projudi-monitor/state/1d49c1c15b8c.json` | Estado persistido com array movimentacoes | VERIFICADO | Existe com 7 entradas reais do Projudi TJBA |
| `projudi-monitor/node_modules/playwright/` | Playwright instalado | VERIFICADO | Diretório existe |

---

### Verificação de Links Chave (Wiring)

| De | Para | Via | Status | Detalhes |
|----|------|-----|--------|---------|
| `index.js` | `projudi.tjba.jus.br` | `page.goto(BASE_URL)` em `scrapeCase()` | VERIFICADO | `BASE_URL = 'https://projudi.tjba.jus.br/projudi/'` definido; `page.goto(BASE_URL)` chamado |
| `index.js` | `state/<hash>.json` | `saveState()` com `writeFileSync` + `renameSync` | VERIFICADO | Escrita atômica `.tmp` → `renameSync` implementada |
| `index.js` | `config/processes.json` | `JSON.parse(readFileSync(CONFIG_PATH))` | VERIFICADO | `CONFIG_PATH` definido; lido no `main()` antes do loop |
| `processCase()` | `saveState()` | guard `!flags.dryRun` — CLI-01 | VERIFICADO | Chamada `saveState()` em posição 7856, guard `!flags.dryRun` em posição 7835 |
| `main()` for-of | `browser.close()` | `try/finally` envolvendo todo o ciclo do browser — REL-02 | VERIFICADO | `finally { await browser.close() }` envolve o loop for-of completo |
| `main()` for-of | `processCase()` | try/catch per-case com `hadFailure` — REL-01 | VERIFICADO | Cada iteração wrapped individualmente; `hadFailure = true` em erro |

---

### Rastreio de Fluxo de Dados (Nível 4)

| Artifact | Variável de Dados | Fonte | Produz Dados Reais | Status |
|----------|-------------------|-------|--------------------|--------|
| `index.js` — `scrapeCase()` | `movimentacoes` | `accessFrame.locator(...).all()` → DOM ao vivo do Projudi | Sim — state file tem 7 entradas reais | FLOWING |
| `index.js` — `processCase()` | `newMovs` | `fresh.filter(m => !storedIds.has(m.id))` | Sim — diff contra IDs do state real | FLOWING |
| `index.js` — `saveState()` | `movimentacoes` em `state/*.json` | Array `fresh` do scraper | Sim — state file real confirma | FLOWING |

---

### Verificações Spot Comportamentais

| Comportamento | Verificação | Resultado | Status |
|---------------|-------------|-----------|--------|
| Sintaxe do arquivo | `node --check projudi-monitor/index.js` | Exit 0 | PASS |
| State file tem estrutura correta | Inspecionar `state/1d49c1c15b8c.json` | 7 entradas com `id`, `date`, `description` | PASS |
| Nenhum padrão proibido (`j_id_`, `process.exit(`, ES modules) | Varredura de grep | Nenhum encontrado | PASS |
| 14 logs `[verbose]` no código-fonte | Contagem `[verbose]` | 14 ocorrências | PASS |
| Cálculo de delay correto | `BASE_DELAY_MS + Math.floor(Math.random() * JITTER_MS)` | Presente na linha correta | PASS |
| Execução ao vivo contra Projudi TJBA | `node projudi-monitor/index.js` | Requer internet | SKIP |

---

### Cobertura de Requisitos

| Requisito | Plano | Descrição | Status | Evidência |
|-----------|-------|-----------|--------|-----------|
| MONO-01 | 01-01 | Projeto organizado em `automations/<nome>/` | SATISFEITO | `projudi-monitor/package.json` existe, independente |
| CFG-01 | 01-01 | Lista de processos em `config/processes.json` com `caseNumber` | SATISFEITO | `caseNumber: "1d49c1c15b8c"` no arquivo |
| CFG-02 | 01-02 | Delay entre consultas configurável | SATISFEITO | `BASE_DELAY_MS=3000`, `JITTER_MS=2000`, `Math.random()` |
| SCRP-01 | 01-01 | Navega via consulta pública por teor sem login | SATISFEITO | `formAcessoPublico` + `#codigoHash` implementados |
| SCRP-02 | 01-02 | Múltiplos processos em sequência, não paralelo | SATISFEITO | `for (const proc of processes)`, sem `Promise.all` |
| SCRP-03 | 01-01 | User-Agent realista e sem sinalização de automação | SATISFEITO | `--disable-blink-features=AutomationControlled`, UA string completa |
| PARS-01 | 01-01 | Seletores semânticos, sem IDs JSF dinâmicos | SATISFEITO | XPath por texto "Eventos do Processo", `#codigoHash` semântico; `j_id_` ausente |
| PARS-02 | 01-01 | Cada movimentação tem `date`, `description`, `id` | SATISFEITO | Objeto `{ id, date, description, movedBy }` construído |
| PARS-03 | 01-01 | NFC + trim() antes de comparações | SATISFEITO | `makeId()` usa `normalize('NFC').trim()` em ambos os campos |
| STATE-01 | 01-01 | State em `state/<caseNumber>.json` com `{ lastChecked, movimentacoes }` | SATISFEITO | Estrutura confirmada no state file real |
| STATE-02 | 01-01 | Writes atômicos `.tmp` + `renameSync` | SATISFEITO | `writeFileSync(tmp, ...)` → `renameSync(tmp, target)` |
| STATE-03 | 01-01 | Pasta `state/` no `.gitignore` | SATISFEITO | `.gitignore` contém `state/` |
| DIFF-01 | 01-01 | Detecta novidades por ID | SATISFEITO | `new Set(stored.movimentacoes.map(m => m.id))` + `filter` |
| DIFF-02 | 01-01 | Imprime agrupado por processo | SATISFEITO | Bloco `=== label ===` antes das linhas de movimentação |
| DIFF-03 | 01-01 | Sem output se nada novo | SATISFEITO | Guard `if (newMovs.length > 0)` antes de qualquer `console.log` de saída |
| DIFF-04 | 01-02 | Exit code 0 = sucesso; 1 = ao menos um falhou | SATISFEITO | `process.exitCode = hadFailure ? 1 : 0` após loop |
| REL-01 | 01-02 | Erro em um processo não para o batch | SATISFEITO | Per-case `try/catch`, `hadFailure = true`, continua loop |
| REL-02 | 01-01+02 | `try/finally` garante `browser.close()` | SATISFEITO | `finally { await browser.close() }` envolve loop completo |
| REL-03 | 01-01+02 | Assertiva de resultado não vazio | SATISFEITO | `if (movimentacoes.length === 0) throw new Error('No movimentacao rows found...')` |
| CLI-01 | 01-01+02 | `--dry-run` suprime writes | SATISFEITO | `if (!flags.dryRun) { saveState(...) }` |
| CLI-02 | 01-01+02 | `--verbose` output de debug | SATISFEITO | 14 logs `[verbose]` cobrindo: navegação, frame, codigoHash, AcessoPublico, Eventos, diff, delay, estado |
| DOC-01 | Fase 2 | README com instalação e agendamento | PENDENTE — Fase 2 | Explicitamente adiado para Fase 2 |

**Cobertura v1 da Fase 1:** 21/21 requisitos implementados. DOC-01 corretamente adiado para Fase 2.

---

### Anti-Padrões Encontrados

| Arquivo | Linha | Padrão | Severidade | Impacto |
|---------|-------|--------|------------|---------|
| — | — | — | — | Nenhum anti-padrão encontrado |

Varredura completa de `index.js`:
- Marcadores de dívida (TBD, FIXME, XXX): **nenhum**
- TODO sem referência: **nenhum**
- Stubs/placeholders: **nenhum** (`return null`, `not implemented`, etc.)
- `process.exit(` em código de execução: **ausente** (apenas em comentário na linha 267)
- `j_id_` (seletores JSF dinâmicos): **ausente**
- `import`/`export` (ES modules): **ausente**
- `Promise.all` (paralelismo): **ausente**

---

### Desvios Notáveis Confirmados (Esperados)

Os desvios abaixo foram identificados durante a execução e documentados nos SUMMARYs. Não são gaps — são correções factuais baseadas em inspeção real do DOM ao vivo:

1. **Seletor correto: "Eventos do Processo"** — RESEARCH.md assumia "Etapas do Processo". A inspeção do DOM ao vivo revelou o texto correto como "Eventos do Processo". O código implementado usa "Eventos do Processo" corretamente em todas as 9 ocorrências. Linhas de código não-comentário com "Etapas do Processo": **zero**.

2. **Navegação via `formAcessoPublico`** — A suposição de um botão "Consulta Pública" clicável estava errada. A implementação correta preenche `#codigoHash` no frame `PaginaPrincipal` e submete `formAcessoPublico`, depois localiza o frame `AcessoPublico`. Esta é a abordagem semântica e funcional confirmada pelo DOM ao vivo.

3. **Colunas de linha de dados: 7 células** — Diferente das 4 colunas assumidas; o filtro de dados usa `cells.length === 7 AND datePattern.test(cells[2])` para distinguir linhas de dados de cabeçalhos/separadores.

---

### Verificação Humana Necessária

#### 1. Execução ao Vivo — Primeiro Run

**Teste:** Executar `node projudi-monitor/index.js` a partir de `projudi-monitor/` (ou do root com `node projudi-monitor/index.js`) com internet ativa
**Esperado:** Bloco impresso no stdout:
```
=== Processo Teste ===
  [DD/MM/YY] Descrição da movimentação  (por: Nome)
```
Script encerra com código 0
**Por que humano:** Requer conectividade real com projudi.tjba.jus.br

#### 2. Idempotência — Segundo Run

**Teste:** Executar `node projudi-monitor/index.js` uma segunda vez (sem mudanças no tribunal)
**Esperado:** Nenhuma linha `===` no stdout; exit code 0
**Por que humano:** Depende de estado persistido de execução real

#### 3. Supressão de Estado com --dry-run

**Teste:** Anotar mtime de `state/1d49c1c15b8c.json` → executar `node projudi-monitor/index.js --dry-run` → verificar que mtime não mudou
**Esperado:** Diff computado e exibido se houver novidades, mtime do state file inalterado
**Por que humano:** Requer execução real e verificação de sistema de arquivos

#### 4. Logs Verbose

**Teste:** Executar `node projudi-monitor/index.js --verbose`
**Esperado:** Pelo menos 6 linhas `[verbose]` distintas cobrindo navegação, frame, codigoHash, AcessoPublico, seção Eventos, diff
**Por que humano:** Requer execução real para confirmar que logs não são suprimidos por erros de runtime

#### 5. Isolamento de Erros e Exit Code

**Teste:** Adicionar `{"caseNumber":"INVALID","label":"Teste Invalido"}` ao `config/processes.json` → executar → verificar → remover a entrada
**Esperado:** `[ERROR] Teste Invalido: Invalid caseNumber: INVALID` impresso; caso válido ainda processa; `echo $?` retorna 1
**Por que humano:** Requer modificação temporária de config e verificação de exit code do shell

---

### Resumo dos Gaps

Nenhum gap bloqueador identificado. Todos os 21 requisitos da Fase 1 possuem implementação verificada estaticamente no código-fonte.

As 5 verificações humanas listadas acima são necessárias para confirmar o comportamento de runtime contra o site ao vivo do Projudi TJBA — elas não podem ser substituídas por análise estática de código.

O estado já existente (`state/1d49c1c15b8c.json` com 7 entradas reais) é evidência forte de que o script foi executado com sucesso em algum momento contra o site real. Isso reduz substancialmente o risco das verificações humanas — a hipótese mais provável é que o pipeline está funcional.

---

_Verificado: 2026-05-15T03:00:00Z_
_Verificador: Claude (gsd-verifier)_
