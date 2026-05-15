# Phase 1: Core Pipeline - Research

**Researched:** 2026-05-14
**Domain:** Playwright browser automation, JSF DOM scraping, atomic state management, Node.js CLI
**Confidence:** MEDIUM-HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Launch a new headless Chromium instance per run (Playwright's own Chromium). Do NOT connect to an existing Chrome session via CDP. No headed mode — fully headless for cron compatibility.
- **D-02:** Entry URL is `https://projudi.tjba.jus.br/projudi/`. From there, click the "Consulta Pública" button (red button — use semantic text selector, never JSF-generated ID).
- **D-03:** After clicking, fill the teor search field with the case's teor hash (e.g., `1d49c1c15b8c`) and press Enter. This navigates directly to the "DADOS DO PROCESSO" page — no intermediate page or result list.
- **D-04:** Movimentações are extracted from the "Etapas do Processo" table on the process page. Each row is one movimentação, with columns: description, date (DD/MM/YY), "Movimentado por", "Arquivo/Observação".
- **D-05:** The `caseNumber` in `config/processes.json` is the teor hash (e.g., `1d49c1c15b8c`), NOT the CNJ process number. State files are named `state/<teor-hash>.json`.
- **D-06:** Each movimentação's unique ID is a composite of **date + description**, both NFC-normalized and trimmed before concatenation. Stored in the `id` field of each movimentação object.

### Claude's Discretion

- Terminal output format (how new movimentações are printed — labels, separators, timestamps): planner chooses a clean, readable format
- Internal code structure (single `index.js` vs. separate modules for scraper/state/diff): planner decides based on simplicity and CLAUDE.md guidelines
- Exact selector strings for "Etapas do Processo" table rows: researcher identifies robust semantic selectors from Projudi's DOM

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MONO-01 | Project organized in `automations/<name>/` with independent `package.json` | Standard monorepo file layout — no library needed |
| CFG-01 | Configurable case list in `config/processes.json` with `caseNumber` field | Plain `JSON.parse(fs.readFileSync(...))` — no schema library needed at MVP |
| CFG-02 | Configurable delay between queries (default 3000ms + random jitter) | `Math.random()` jitter; see Code Examples |
| SCRP-01 | Navigate Projudi via "consulta pública por teor" without login/CAPTCHA | Confirmed: public endpoint, no auth required. See Projudi DOM section. |
| SCRP-02 | Support multiple processes sequentially | Standard `for...of` loop with `await`; no concurrency primitives needed |
| SCRP-03 | Realistic User-Agent and no automation signaling | `args: ['--disable-blink-features=AutomationControlled']` + custom userAgent on `newContext()` |
| PARS-01 | Extract movimentações with semantic selectors (no JSF dynamic IDs) | See Selector Strategy section |
| PARS-02 | Each movimentação has `date`, `description`, `id` (NFC composite) | See Data Model section |
| PARS-03 | NFC normalize + trim before any comparison | `str.normalize('NFC').trim()` — built-in, no library needed |
| STATE-01 | State persisted in `state/<caseNumber>.json` with `{ lastChecked, movimentacoes }` | See State Management section |
| STATE-02 | Atomic writes via write-to-.tmp + `fs.renameSync` | See Atomic Write Pattern |
| STATE-03 | `state/` added to `.gitignore` | Single-line `.gitignore` entry |
| DIFF-01 | Detect new movimentações by comparing fresh vs stored by ID | `Set` difference — O(n) |
| DIFF-02 | Print new movimentações to terminal grouped by process | `console.log` with labeled output format |
| DIFF-03 | No output if no new entries (idempotent) | Simple `if (newItems.length > 0)` guard |
| DIFF-04 | Exit code 0 = full success; exit code 1 = any failure | `process.exitCode = 1` pattern — see Error Handling section |
| REL-01 | Error in one process does not stop batch | `try/catch` per case in `for...of` |
| REL-02 | `try/finally` ensures `browser.close()` always runs | Standard Playwright teardown pattern |
| REL-03 | Assert result container is not empty (detect silent empty scrape) | Check `rows.length > 0` before processing; throw if zero |
| CLI-01 | `--dry-run` flag — show diff but do not save state | `process.argv.includes('--dry-run')` |
| CLI-02 | `--verbose` flag — additional debug output | `process.argv.includes('--verbose')` |
</phase_requirements>

---

## Summary

Phase 1 delivers a single Node.js script that orchestrates a Playwright headless Chromium session to scrape court movimentações from Projudi TJBA, compare them against a local JSON state file, and print new entries to the terminal. The stack is intentionally minimal: Playwright 1.60 (already the registry latest) plus Node.js built-ins (`fs/promises`, `path`, `process`).

The primary technical challenge is selector stability on a JSF application that generates dynamic `j_id_*` IDs for most elements. The mitigation is straightforward: use Playwright's text-based and structural locators (`getByText`, `locator('text=...')`, and CSS structural selectors anchored on visible label text) — none of which rely on JSF-generated attributes.

The secondary challenge is headless bot detection avoidance. Projudi TJBA is a government court system; it likely has no aggressive anti-bot measures, but passing a realistic User-Agent and the `--disable-blink-features=AutomationControlled` Chromium flag eliminates the most obvious detection vectors.

**Primary recommendation:** Build the walking skeleton first — navigate to one hardcoded process, extract the table, print rows, save state — then layer in the loop, diff, and CLI flags. This validates the selector strategy before investing in the full pipeline.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Browser launch + teardown | CLI script | — | Single headless Chromium per run; no server needed |
| Projudi navigation + scraping | CLI script (Playwright) | — | All browser interaction lives in the script |
| Data extraction + normalization | CLI script | — | NFC normalize + trim at parse time, before ID computation |
| State read/write | CLI script (fs/promises) | — | Local JSON files; no external storage |
| Diff computation | CLI script | — | Pure in-memory set comparison |
| Terminal output | CLI script | — | `console.log` direct; no logging framework needed |
| Scheduling | OS (cron / Task Scheduler) | — | Out of scope for Phase 1; script is fire-and-exit |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| playwright | 1.60.0 | Headless Chromium automation | Already declared in CLAUDE.md; confirmed latest on npm registry `[VERIFIED: npm registry]` |
| Node.js built-ins | 22.x (runtime) | `fs/promises`, `path`, `process` | No external dependency for state I/O, CLI parsing, or NFC normalization |

### Supporting (none needed)

The MVP deliberately avoids additional npm packages:

| Instead of | Could Use | Why Not Now |
|------------|-----------|-------------|
| `write-file-atomic` (npm) | Hand-written tmp+rename | CLAUDE.md mandates atomic writes; the pattern is 3 lines — no library needed |
| `minimist` / `commander` | `process.argv.includes(...)` | Two flags (`--dry-run`, `--verbose`) need no parser |
| `dotenv` | Hard-coded defaults in config | Config is a JSON file, not environment variables |
| `winston` / `pino` | `console.log` / `console.error` | MVP; DOC-01 is Phase 2, no log files in Phase 1 |

**Installation:**
```bash
cd projudi-monitor
npm install playwright@^1.60.0
npx playwright install chromium
```

**Version verification:** `npm view playwright version` returned `1.60.0` on 2026-05-14. `[VERIFIED: npm registry]`

---

## Projudi DOM Structure

### What the Manual and Screenshots Confirm `[VERIFIED: manual PDF + screenshots 2026-05-14]`

From the official Projudi-NAJ manual (PDF) and two DevTools screenshots captured on 2026-05-14:

**Home page (`https://projudi.tjba.jus.br/projudi/`):**
- A "Consulta Pública" button sits at the bottom-center of the login screen
- The button is rendered as an `<input type="image">` or an `<a>` element with the visible text "Consulta Pública" (confirmed visually in the manual screenshot)
- The page uses JSF — the button likely has a dynamic `j_id_*` name/id attribute; the stable signal is the visible text

**Teor search page (after clicking "Consulta Pública"):**
- A search form appears with a text input for the teor hash
- The input is labeled visually but has no guaranteed stable `id`; the stable approach is to target it by its proximity to the visible label text "Teor do processo" or by being the only visible text input on the page at that point
- After filling + pressing Enter (or clicking a submit button), the page navigates directly to "DADOS DO PROCESSO"

**Process page ("DADOS DO PROCESSO"):**
- The "Etapas do Processo" section is a visible section header with a table below it
- From DevTools screenshot (2026-05-14_22h56_05.png): the table rows contain columns in order — description (first column, most text), date (DD/MM/YY format), "Movimentado por", "Arquivo/Observação"
- The table is a standard HTML `<table>` with `<tr>` rows inside a `<tbody>`
- Each row is a `<tr>` that contains `<td>` cells

### Selector Strategy `[ASSUMED for exact attribute names; VERIFIED for general approach]`

**Key principle:** JSF generates dynamic `id` and `name` attributes (`j_id_1`, `j_id_2`, etc.) that change across sessions and deployments. The following attributes are stable across JSF renders:

| Attribute Type | Stable? | Rationale |
|----------------|---------|-----------|
| `id="j_id_*"` | NO | Generated by JSF component tree position — changes on any template edit |
| `name="j_id_*"` | NO | Same as above |
| Visible text content | YES | User-facing labels do not change with JSF implementation |
| `class` with semantic names | MAYBE | Application-defined classes survive (e.g., `class="rich-table"`) but JSF-internal utility classes may not |
| `type` attribute on inputs | YES | `type="text"`, `type="submit"`, `type="image"` are author-controlled |
| Element tag + structural position | YES | `table > tbody > tr > td:nth-child(N)` is stable when table structure is fixed |

**Recommended selector approach:**

```javascript
// 1. "Consulta Pública" button — match by visible text (case-insensitive substring)
// The button text is unambiguous on the home page
await page.getByText('Consulta Pública', { exact: false }).click();
// Fallback: page.locator('input[type="image"]') if getByText doesn't resolve to a clickable element

// 2. Teor input field — only visible text input on the search form
// Use the label text to anchor; if label is not a <label for="..."> element, use proximity
await page.locator('input[type="text"]').first().fill(teorHash);
// OR if there are multiple inputs: anchor on containing element near "Teor" label text
await page.locator('text=Teor').locator('..').locator('input[type="text"]').fill(teorHash);

// 3. "Etapas do Processo" table — anchor on section heading text, then find the next table
// The heading "Etapas do Processo" is visible text in the page
const etapasSection = page.locator('text=Etapas do Processo');
// The table immediately follows (or is the next sibling/cousin element)
const tableRows = page.locator('table').filter({ has: page.locator('text=Etapas do Processo') }).locator('tr');
// If the heading is outside the table: use the following-sibling table
// ASSUMED: exact DOM relationship between heading and table needs runtime verification
```

**Important caveat:** The exact relationship between the "Etapas do Processo" heading and the `<table>` element is `[ASSUMED]` — it may be:
- The heading is a `<caption>` inside the table → `table:has(caption:text("Etapas do Processo")) tr`
- The heading is a row inside the table → skip first row
- The heading is in a preceding `<div>` or `<span>` → use XPath preceding-sibling

The executor MUST inspect the live DOM during implementation and confirm the exact relationship. A headed run (`headless: false`) with `page.pause()` is the recommended approach for this verification step.

**Resilient fallback selector for the table rows:**
```javascript
// XPath: find the table that follows (or contains) the text "Etapas do Processo"
const rows = await page.locator('xpath=//table[.//text()[contains(., "Etapas do Processo")]]//tr').all();
// OR: all tables on the page — filter by presence of date column pattern (DD/MM/YY)
```

### Column Extraction

From the DevTools screenshot, the table columns in order are:
1. **Description** (col 1) — the movimentação name/text, longest field
2. **Date** (col 2) — DD/MM/YY format
3. **Movimentado por** (col 3) — person/system that moved it
4. **Arquivo/Observação** (col 4) — optional attachment/note

```javascript
// Extract all rows from the Etapas table
const rows = await page.$$eval(
  'selector-for-etapas-table tr',
  (trs) => trs
    .filter(tr => tr.querySelectorAll('td').length >= 2)  // skip header rows
    .map(tr => {
      const cells = tr.querySelectorAll('td');
      return {
        description: cells[0]?.innerText?.trim() ?? '',
        date: cells[1]?.innerText?.trim() ?? '',
        movedBy: cells[2]?.innerText?.trim() ?? '',
      };
    })
    .filter(row => row.description && row.date)  // skip empty/header rows
);
```

---

## Architecture Patterns

### System Architecture Diagram

```
[config/processes.json]
         |
         v
   [index.js: main()]
         |
         |-- parse CLI flags (--dry-run, --verbose)
         |-- launch Playwright Chromium browser
         |
         v
   [for each caseNumber] ──> try/catch per case (REL-01)
         |
         |-- navigate to Projudi homepage
         |-- click "Consulta Pública"
         |-- fill teor hash + Enter
         |-- waitForSelector "Etapas do Processo"
         |-- assert rows.length > 0 (REL-03)
         |-- extract rows → normalize → build movimentação objects
         |
         |-- read state/<hash>.json (or empty if first run)
         |-- compute diff: fresh IDs - stored IDs
         |
         |-- if diff not empty: print to terminal (DIFF-02)
         |-- if not --dry-run: atomic write state (STATE-02)
         |
         |-- delay + jitter before next case (CFG-02)
         |
   [catch error]
         |-- console.error(case, error)
         |-- set hadFailure = true
         |
   [finally: browser.close()]
         |
   [process.exitCode = hadFailure ? 1 : 0]
```

### Recommended Project Structure

```
projudi-monitor/
├── index.js           # Entry point and main orchestration (MONO-01)
├── package.json       # { "type": "module" } or CommonJS — planner decides
├── config/
│   └── processes.json # [{ "caseNumber": "1d49c1c15b8c", "label": "..." }]
├── state/             # gitignored — created at runtime
│   └── <hash>.json    # { lastChecked, movimentacoes: [...] }
└── .gitignore         # includes state/
```

**Module structure (planner's discretion):** For an MVP with ~150-200 lines total, a single `index.js` is appropriate. If the file grows beyond 300 lines, split into `scraper.js`, `state.js`, `diff.js` as named exports.

### Pattern 1: Playwright Browser Lifecycle with try/finally

```javascript
// Source: Playwright official docs (playwright.dev/docs/api/class-browsertype)
const { chromium } = require('playwright');

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  locale: 'pt-BR',
  timezoneId: 'America/Bahia',
});
try {
  // ... all scraping work
} finally {
  await browser.close(); // REL-02: always runs even on error
}
```

### Pattern 2: Sequential Case Loop with Per-Case Error Isolation

```javascript
// Source: [ASSUMED] — standard Node.js async pattern
let hadFailure = false;

for (const { caseNumber, label } of processes) {
  try {
    await processCase(page, caseNumber, label, flags);
  } catch (err) {
    console.error(`[ERROR] ${label ?? caseNumber}: ${err.message}`);
    hadFailure = true;
  }
  // delay between cases (CFG-02)
  if (caseNumber !== processes.at(-1).caseNumber) {
    await delay(BASE_DELAY_MS + Math.random() * JITTER_MS);
  }
}

process.exitCode = hadFailure ? 1 : 0; // DIFF-04
```

**Why `process.exitCode` instead of `process.exit(1)`:** `process.exit()` terminates immediately and may prevent the `finally` block from running async cleanup. Setting `process.exitCode` lets the event loop drain naturally. `[VERIFIED: Node.js docs behavior]`

### Pattern 3: Atomic State Write

```javascript
// Source: [CITED: nodejs.org/api/fs.html#fsrenamesyncoldpath-newpath]
const { writeFileSync, renameSync, mkdirSync } = require('fs');
const { join } = require('path');

function saveState(stateDir, caseNumber, data) {
  mkdirSync(stateDir, { recursive: true });
  const target = join(stateDir, `${caseNumber}.json`);
  const tmp = `${target}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, target);  // atomic on Linux; near-atomic on Windows (STATE-02)
}
```

**Windows note:** `fs.renameSync` is not guaranteed atomic on Windows when source and target are on different volumes. Since both `.tmp` and `.json` are in the same `state/` directory (same volume), the rename is functionally atomic for crash protection purposes. `[ASSUMED: Windows same-volume rename behavior]`

### Pattern 4: NFC Normalization for Movimentação ID

```javascript
// Source: [CITED: MDN String.prototype.normalize()]
function makeId(date, description) {
  const d = date.normalize('NFC').trim();
  const desc = description.normalize('NFC').trim();
  return `${d}|${desc}`;
}
```

### Pattern 5: Diff Algorithm

```javascript
// Source: [ASSUMED] — standard Set difference pattern
function findNew(fresh, stored) {
  const storedIds = new Set((stored.movimentacoes ?? []).map(m => m.id));
  return fresh.filter(m => !storedIds.has(m.id));
}
```

### Pattern 6: CLI Flag Parsing (no external library)

```javascript
// Source: [ASSUMED] — standard Node.js process.argv pattern
const args = process.argv.slice(2);
const flags = {
  dryRun: args.includes('--dry-run'),
  verbose: args.includes('--verbose'),
};
```

### Pattern 7: Delay with Jitter

```javascript
// Source: [ASSUMED] — standard pattern for polite scraping
const BASE_DELAY_MS = 3000;
const JITTER_MS = 2000; // up to 2s additional random delay

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

await sleep(BASE_DELAY_MS + Math.random() * JITTER_MS);
```

### Pattern 8: JSF Navigation — Waiting After Click

JSF form submissions may or may not change the URL. After clicking "Consulta Pública" and submitting the teor form, the safest wait strategy is:

```javascript
// Source: [CITED: playwright.dev/docs/api/class-page#page-wait-for-load-state]
// After click that triggers navigation:
await page.getByText('Consulta Pública', { exact: false }).click();
await page.waitForLoadState('networkidle'); // wait for JSF AJAX to settle

// After filling teor and pressing Enter:
await page.locator('input[type="text"]').first().fill(teorHash);
await Promise.all([
  page.waitForLoadState('domcontentloaded'),
  page.keyboard.press('Enter'),
]);

// Wait for the "Etapas do Processo" section to appear — confirms correct page
await page.waitForSelector('text=Etapas do Processo', { timeout: 15000 });
```

**Why `networkidle`:** JSF uses Ajax heavily — `domcontentloaded` fires before AJAX updates complete. `networkidle` waits for 500ms of no network requests, which is more reliable for JSF-rendered content. `[CITED: playwright.dev/docs/navigations]`

**`waitForNavigation` is deprecated** as of Playwright v1.26+. Use `waitForLoadState` or `waitForSelector` instead. `[VERIFIED: playwright GitHub issue #20853]`

### Anti-Patterns to Avoid

- **Using `j_id_*` selectors:** `page.locator('#j_id_12')` — breaks on every JSF redeployment
- **Using row index as movimentação ID:** `tr:nth-child(3)` — breaks if rows reordered or new rows inserted before existing ones
- **`page.waitForNavigation()` as a standalone promise:** Deprecated and racy. Use `Promise.all([waitForLoadState, click])` pattern or just wait for a known element to appear post-navigation.
- **Not closing browser on exception:** Always use `try/finally`. On Windows, orphaned Chromium processes accumulate and cause port exhaustion.
- **Parallel `page.goto()` calls:** CLAUDE.md prohibits parallel requests to Projudi. Use strict `for...of` (not `Promise.all`).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic file writes | Custom locking/file flags | `writeFileSync` + `renameSync` (built-in) | Same-directory rename is near-atomic; 3 lines |
| String normalization | Custom Unicode handling | `str.normalize('NFC').trim()` (built-in) | Handles all Portuguese diacritics correctly |
| CLI flag parsing | Regex on argv | `process.argv.includes('--flag')` | Two flags only; no argument values needed |
| Browser automation | HTTP requests + HTML parse | Playwright | Projudi uses JSF + server-side rendering; pure HTTP scraping would require reconstructing JSF state tokens |
| Delay/sleep | Busy-wait loop | `new Promise(resolve => setTimeout(resolve, ms))` | Standard async sleep; no library needed |

**Key insight:** Projudi TJBA cannot be scraped with simple HTTP requests (e.g., `fetch` + `cheerio`) because JSF maintains server-side component state and requires a real browser session with cookies and ViewState tokens. Playwright is the correct tool.

---

## Common Pitfalls

### Pitfall 1: JSF ViewState and Session Expiry

**What goes wrong:** JSF maintains a server-side session. If the browser session expires mid-batch (long-running process), subsequent navigation requests may redirect to an error page or the login page instead of the expected "DADOS DO PROCESSO" page.

**Why it happens:** Government JSF applications typically have short session timeouts (15-30 minutes). A batch checking many processes may exceed this.

**How to avoid:** After filling the teor and navigating, always assert that `page.locator('text=Etapas do Processo')` is visible before extracting rows. If the assertion fails, log an error and continue to the next case. Do not retry silently — loud failure is better than silent wrong data.

**Warning signs:** `waitForSelector` timeout on "Etapas do Processo" after previously working; page URL ends in `PaginaPrincipal.jsp` or similar login redirect.

### Pitfall 2: Empty Table (REL-03 Violation)

**What goes wrong:** The scraper finds the table container but it has zero data rows (header only). State is saved as empty, wiping previously known movimentações.

**Why it happens:** Network hiccup, AJAX timeout, or page loaded before JSF completed the table render.

**How to avoid:** After extracting rows, assert `rows.length > 0` before processing. Throw an error if zero — this triggers the per-case error handler (REL-01) and skips the state write.

```javascript
if (rows.length === 0) {
  throw new Error(`No rows found in Etapas do Processo for ${caseNumber} — possible page load failure`);
}
```

### Pitfall 3: NFC Normalization Applied Inconsistently

**What goes wrong:** ID computed at scrape time uses `NFC`, but ID loaded from state file does not re-normalize. A character stored as NFC in JSON is read back as NFC, but a freshly scraped character from a JSF page may arrive in a different normalization form. They appear identical visually but `===` comparison returns false — false positives on every run.

**Why it happens:** HTML content from JSF may use NFD or mixed normalization for accented Portuguese characters (ã, ç, é, etc.).

**How to avoid:** Always normalize at both read-from-DOM time AND at comparison time. The `makeId()` function must be the single source of truth for ID construction — use it in both the scraper and the diff computation.

### Pitfall 4: `renameSync` Across Volumes on Windows

**What goes wrong:** If `state/` and the temp directory are on different drives, `renameSync` fails with EXDEV.

**Why it happens:** Writing to `os.tmpdir()` (which may be `C:\Temp`) then renaming to `D:\state\` fails.

**How to avoid:** Write the `.tmp` file to the same directory as the target. Use `target + '.tmp'` not `os.tmpdir()`.

### Pitfall 5: Headless Mode Fingerprinting

**What goes wrong:** Projudi detects the Playwright Chromium user-agent (`HeadlessChrome/...`) and blocks or throttles requests.

**Why it happens:** Default Playwright headless mode sets a user-agent containing "HeadlessChrome".

**How to avoid:** Set a realistic user-agent in `browser.newContext()`:
```javascript
userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
```
And pass `--disable-blink-features=AutomationControlled` to the launch args.

**Assessment for Projudi:** Government court systems typically do not have sophisticated bot detection. This mitigation is defensive but low-effort. `[ASSUMED: no confirmed bot-detection on Projudi TJBA]`

### Pitfall 6: `waitForNavigation` Race Condition

**What goes wrong:** Calling `await page.click(...)` followed by `await page.waitForNavigation()` can miss the navigation event if the navigation starts and completes between the two calls.

**Why it happens:** `waitForNavigation` must be set up BEFORE the action that triggers navigation.

**How to avoid:** Use `Promise.all([page.waitForLoadState(...), page.click(...)])` or simply wait for a known element to appear after the click:
```javascript
await page.click('...');
await page.waitForSelector('text=Etapas do Processo');
```

---

## Walking Skeleton Recommendation

**Build this first to validate the end-to-end pipeline before adding loops, diff, and CLI flags:**

```
Wave 0 (skeleton):
  1. Launch Chromium
  2. Navigate to Projudi homepage
  3. Click "Consulta Pública"
  4. Fill hardcoded teor hash ("1d49c1c15b8c") + press Enter
  5. Assert "Etapas do Processo" is visible
  6. Extract table rows, log raw output to console
  7. Close browser

Expected outcome: See raw movimentação data in the terminal.
```

This validates:
- Selector for "Consulta Pública" button (most uncertain part)
- Navigation + wait strategy works for JSF
- Table selector finds the right rows
- Column layout matches assumption

Only after this works should the planner add: state read/write, diff, multi-process loop, delay, CLI flags.

**Critical path:** Home → click "Consulta Pública" → fill teor → confirm "Etapas do Processo" → extract rows. This is the riskiest sequence (JSF rendering, selector correctness). Everything else (diff, state, CLI) is straightforward Node.js.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `page.waitForNavigation()` | `page.waitForLoadState()` or `waitForSelector()` | Playwright v1.26 | `waitForNavigation` is now deprecated; new code must use alternatives |
| `headless: true` (old mode) | Default headless (new Chromium headless shell) | Playwright v1.45 | New headless is faster and more fingerprint-resistant; no config change needed |
| `page.$eval` / `page.$$eval` | `locator.evaluate()` / `locator.evaluateAll()` | Playwright v1.14+ | Locator API preferred; `$$eval` still works but locators are more readable |

**No deprecated APIs in the recommended patterns above.**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Consulta Pública" button is reachable via `page.getByText('Consulta Pública')` — it may be an `<input type="image">` that requires a different selector | Projudi DOM Structure / Selector Strategy | Selector fails; executor must find alternative (e.g., `input[type="image"]`, XPath) |
| A2 | Filling the teor hash + Enter navigates directly to "DADOS DO PROCESSO" (confirmed by user, but not by live DOM inspection) | Projudi DOM Structure | Could be an intermediate page or AJAX result — executor must verify |
| A3 | "Etapas do Processo" heading and its table are siblings or parent-child in the DOM (exact relationship unknown) | Selector Strategy | Table selector may need adjustment; execute with `headless: false` + `page.pause()` to inspect |
| A4 | Column order in "Etapas do Processo" is: [description, date, movedBy, attachment] | Column Extraction | If columns are in a different order, extracted data will be wrong silently |
| A5 | Projudi TJBA has no aggressive bot detection that would block headless Chromium | Pitfall 5 | If blocked, script will fail; mitigation is the userAgent + AutomationControlled args already planned |
| A6 | `fs.renameSync` same-directory on Windows is functionally atomic for crash protection | Atomic State Write | Could still corrupt on power loss (not a concern for CLI tool; acceptable risk) |
| A7 | Only one visible `input[type="text"]` exists on the teor search form | Selector Strategy | If multiple inputs exist, `.first()` may target the wrong one |

---

## Open Questions

1. **Exact DOM structure of "Consulta Pública" button**
   - What we know: It's at the bottom-center of the home page; visible text is "Consulta Pública"; the manual PDF shows it as a styled button element
   - What's unclear: Is it `<input type="image">`, `<a>`, or `<button>`? Does it have any stable non-JSF class?
   - Recommendation: Executor runs with `headless: false`, inspects element, confirms selector before committing

2. **Exact DOM structure of the teor input field**
   - What we know: It's a text input where the teor hash is typed
   - What's unclear: Is there a `<label>` with stable text? Are there multiple inputs on the form?
   - Recommendation: Same headed-run inspection as above

3. **"Etapas do Processo" table relationship to its heading**
   - What we know: Heading text "Etapas do Processo" appears; table follows
   - What's unclear: Is heading a `<caption>`, a `<th>` row, or a sibling `<div>`?
   - Recommendation: Use XPath `//table[.//text()[contains(., "Etapas do Processo")]]` as the starting point; refine after inspection

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v22.16.0 | — |
| npm | Package install | Yes | 10.9.2 | — |
| playwright (npm) | SCRP-01/02/03 | Yes (latest) | 1.60.0 | — |
| Chromium (Playwright-managed) | Browser automation | Requires `npx playwright install chromium` | Downloaded at install | — |
| Internet access to projudi.tjba.jus.br | All scraping | Assumed available | — | No fallback — script cannot run without it |

**Missing dependencies with no fallback:**
- Chromium browser bundle: must run `npx playwright install chromium` once after `npm install`

---

## Security Domain

> `security_enforcement` not explicitly set to false in config.json — including minimal review.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No login in this script |
| V3 Session Management | No | No user session managed |
| V4 Access Control | No | CLI tool, single user |
| V5 Input Validation | Yes (minimal) | Validate `caseNumber` is a non-empty string before use |
| V6 Cryptography | No | No secrets stored or transmitted |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via malicious `caseNumber` in config | Tampering | Validate caseNumber matches `/^[a-f0-9]+$/` before using in file path `state/<caseNumber>.json` |
| State file corruption (crash during write) | Availability | Atomic write via tmp+rename (STATE-02) |

**Note:** The `caseNumber` is used directly in a file path. A malicious `processes.json` entry like `"../../etc/passwd"` would write outside the `state/` directory. A simple regex validation (`/^[a-f0-9]{8,}$/`) at startup prevents this. `[ASSUMED: teor hashes are lowercase hex strings based on the example `1d49c1c15b8c`]`

---

## Sources

### Primary (HIGH confidence)
- `/microsoft/playwright.dev` (Context7) — BrowserType.launch, newContext userAgent, waitForLoadState, locator API, getByText, page.$$eval
- Projudi-NAJ Manual PDF (`projudi.tjba.jus.br/projudi/download/ManualProjudiNaj.pdf`) — home page UI confirmed, "Consulta Pública" button location and label confirmed
- DevTools screenshots (2026-05-14_22h54_14.png, 2026-05-14_22h56_05.png) — "Etapas do Processo" table visible, column structure partially readable, JSF j_id pattern confirmed
- npm registry: `playwright@1.60.0` confirmed as latest on 2026-05-14

### Secondary (MEDIUM confidence)
- [Playwright GitHub issue #20853](https://github.com/microsoft/playwright/issues/20853) — `waitForNavigation` deprecation confirmed
- [ScrapeOps Playwright undetectable guide](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-make-playwright-undetectable/) — userAgent and AutomationControlled args pattern
- [BrowserStack waitForLoadState guide](https://www.browserstack.com/guide/playwright-waitforloadstate) — networkidle recommended for AJAX-heavy pages

### Tertiary (LOW confidence — needs runtime verification)
- All selector strings marked `[ASSUMED]` require live DOM inspection to confirm
- Windows `renameSync` atomicity claim is based on training knowledge, not OS documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — playwright 1.60.0 confirmed on npm; Node.js built-ins confirmed
- Navigation patterns: HIGH — Playwright docs verified via Context7
- Projudi DOM structure: MEDIUM — manual PDF and screenshots confirm UI labels; exact HTML attributes assumed
- Selector strings: LOW — specific locator expressions need live DOM validation
- Pitfalls: MEDIUM — JSF-specific pitfalls from training knowledge, general Playwright patterns from official docs

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable — Playwright 1.60 is current; Projudi site changes slowly)
