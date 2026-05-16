---
status: complete
phase: 01-core-pipeline
source: [01-VERIFICATION.md]
started: 2026-05-15
updated: 2026-05-16
---

## Current Test

[all tests complete]

## Tests

### 1. Primeiro run imprime movimentações
expected: `node projudi-monitor/index.js` imprime pelo menos um bloco `=== Processo Teste ===` com linhas `[DD/MM/YY] descrição` no terminal
result: pass

### 2. Segundo run é idempotente
expected: Rodar `node projudi-monitor/index.js` uma segunda vez (sem mudanças no estado do processo no Projudi) não produz nenhum output de movimentação — sem falsos positivos
result: pass

### 3. --dry-run não modifica state
expected: `node projudi-monitor/index.js --dry-run` exibe diff (se houver), mas o mtime de `projudi-monitor/state/1d49c1c15b8c.json` não muda — arquivo inalterado
result: pass

### 4. --verbose exibe logs de navegação
expected: `node projudi-monitor/index.js --verbose` exibe pelo menos 3 linhas com prefixo `[verbose]` descrevendo passos de navegação (ex: "Navigating to ...", "Submitted teor hash ...", etc.)
result: pass

### 5. Entrada inválida: isolamento de erro e exit code 1
expected: Adicionar `{"caseNumber": "INVALID", "label": "Teste Erro"}` em `config/processes.json`, rodar o script — o processo inválido gera linha `[ERROR] Teste Erro: ...`, o caso válido ainda processa normalmente, e `echo $?` retorna 1. Remover a entrada inválida depois.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
