# Architecture Research: Automation Monorepo

**Project:** automations  
**Researched:** 2026-05-11  
**Overall confidence:** HIGH

---

## Monorepo Structure

The goal is a flat, no-tooling monorepo where each automation is a fully self-contained folder. No shared workspace protocol (npm workspaces, Turborepo, Nx) is needed — the automations are independent by design and share nothing at runtime. This keeps each folder simple to run, move, or delete without touching anything else.

```
automations/
├── .planning/                  # GSD project planning files (not shipped)
│   ├── PROJECT.md
│   ├── config.json
│   └── research/
│
├── projudi-monitor/            # First automation — Projudi TJBA monitor
│   ├── index.js                # Entry point — run with: node index.js
│   ├── package.json            # Dependencies scoped to this automation only
│   ├── config/
│   │   └── processes.json      # List of case numbers to monitor
│   ├── state/
│   │   └── <case-number>.json  # One file per monitored case, persisted state
│   ├── src/
│   │   ├── configLoader.js     # Reads processes.json, validates structure
│   │   ├── browser.js          # Playwright session setup and teardown
│   │   ├── scraper.js          # Page navigation, form fill, data extraction
│   │   ├── parser.js           # Transforms raw DOM/HTML into structured objects
│   │   ├── stateManager.js     # Read/write state/<case>.json
│   │   ├── diffDetector.js     # Compares new data with stored state
│   │   └── reporter.js         # Formats and prints new movimentacoes to stdout
│   └── README.md               # How to install and run this automation
│
├── <next-automation>/          # Future automations follow the same pattern
│   ├── index.js
│   ├── package.json
│   └── ...
│
└── README.md                   # Root overview: what this repo is, how to add automations
```

### Key structural decisions

- Each automation installs its own `node_modules` via its own `package.json`. Running `npm install` inside `projudi-monitor/` installs only what that automation needs.
- The root has no `package.json`. It is purely a folder convention, not an npm workspace.
- The `state/` folder lives inside the automation folder. It is gitignored — it holds runtime data, not source code.
- The `config/processes.json` file is the only user-facing input. It is committed to source control as a template with placeholder values.

---

## Projudi Monitor Components

| Component | File | Responsibility | Input | Output |
|-----------|------|---------------|-------|--------|
| Config Loader | `src/configLoader.js` | Read and validate `config/processes.json`. Fail fast on missing or malformed entries. | `config/processes.json` path | Array of `{ caseNumber, label? }` |
| Browser Session | `src/browser.js` | Launch Playwright Chromium in headless mode. Expose a `newPage()` helper. Handle teardown. | Playwright config options | Playwright `browser` + `page` objects |
| Scraper | `src/scraper.js` | Navigate to Projudi "consulta por teor", enter case number in the search field, submit, wait for results to load. Returns raw page content. | `page` object, `caseNumber` string | Raw HTML string or Playwright locator handles |
| Parser | `src/parser.js` | Extract structured movimentacoes from raw HTML/DOM. Each movimentacao has at minimum: `{ date, description, id }`. | Raw HTML or locator handles | Array of `{ id, date, description }` objects |
| State Manager | `src/stateManager.js` | Read `state/<caseNumber>.json` (returns empty state if file does not exist). Write updated state back after a run. State shape: `{ lastChecked, movimentacoes: [...] }`. | `caseNumber`, updated data | Persisted JSON file |
| Diff Detector | `src/diffDetector.js` | Compare freshly scraped movimentacoes against stored ones. Identify entries present in the new set but absent from the stored set. Uses `id` or a stable composite key as the identity. | New array, stored array | Array of new (unseen) movimentacoes |
| Reporter | `src/reporter.js` | Format and print new movimentacoes to stdout. If no new entries: print a brief "no changes" message. Designed for both human reading and potential future piping. | Case number, array of new movimentacoes | stdout output |

### Component interfaces (JS conventions)

```js
// configLoader.js
module.exports = { loadConfig }
// loadConfig() → [{ caseNumber: string, label?: string }]

// browser.js
module.exports = { launchBrowser, closeBrowser }
// launchBrowser(options?) → { browser, page }
// closeBrowser(browser) → void

// scraper.js
module.exports = { scrapeCase }
// scrapeCase(page, caseNumber) → rawData (HTML string or structured DOM data)

// parser.js
module.exports = { parseMovimentacoes }
// parseMovimentacoes(rawData) → [{ id, date, description }]

// stateManager.js
module.exports = { loadState, saveState }
// loadState(caseNumber) → { lastChecked: ISO string | null, movimentacoes: [] }
// saveState(caseNumber, state) → void

// diffDetector.js
module.exports = { detectNew }
// detectNew(fresh, stored) → [movimentacao]  (entries in fresh not in stored)

// reporter.js
module.exports = { report }
// report(caseNumber, newMovimentacoes) → void  (side effect: stdout)
```

### index.js orchestrates the pipeline

```js
// Pseudocode — not final implementation
const cases = loadConfig()
const { browser, page } = await launchBrowser()

for (const { caseNumber } of cases) {
  const rawData      = await scrapeCase(page, caseNumber)
  const fresh        = parseMovimentacoes(rawData)
  const state        = loadState(caseNumber)
  const newEntries   = detectNew(fresh, state.movimentacoes)
  report(caseNumber, newEntries)
  saveState(caseNumber, { lastChecked: new Date().toISOString(), movimentacoes: fresh })
}

await closeBrowser(browser)
```

---

## Data Flow

```
processes.json
      |
      v
[ Config Loader ]
      |
      | [{ caseNumber }]
      v
[ Browser Session ] ← Playwright Chromium (headless)
      |
      | page handle
      v
  (for each case)
      |
      v
[ Scraper ] → navigates to Projudi, fills form, waits for DOM
      |
      | raw HTML / locator data
      v
[ Parser ] → extracts structured movimentacoes
      |
      | [{ id, date, description }]
      +------------------------------------------+
      |                                          |
      v                                          v
[ State Manager (read) ]              [ Diff Detector ]
  state/<case>.json                             |
  → stored movimentacoes                        | [new entries only]
                                               v
                                        [ Reporter ]
                                          stdout
                                               |
                                               v
                                    [ State Manager (write) ]
                                      state/<case>.json updated
```

### State file shape

```json
// state/0012345-67.8901.2.34.0567.json
{
  "caseNumber": "0012345-67.8901.2.34.0567",
  "lastChecked": "2026-05-11T14:32:00.000Z",
  "movimentacoes": [
    {
      "id": "mov-20260510-001",
      "date": "2026-05-10",
      "description": "Juntada de petição"
    }
  ]
}
```

### Identity key for diff

Use a composite key derived from `date + description` hashed or slugified as the `id`, since Projudi's public consulta page likely does not expose a native row ID. If the page does expose a unique ID per movimentacao, prefer that. The parser is responsible for assigning a stable `id`.

---

## Build Order

Build in this order because each layer depends on the one before it being stable.

### Step 1 — Config Loader + State Manager (Day 1)

These have zero external dependencies (pure file I/O, no Playwright). Build and test them first with simple unit checks (create a sample `processes.json`, read it back; create a state file, read it back). This validates the data shapes before the browser is involved.

**Why first:** Everything else depends on these two. Getting the shapes right early avoids refactoring the pipeline later.

### Step 2 — Browser Session + Scraper (Day 1-2)

Set up Playwright, navigate to the Projudi "consulta por teor" page, and confirm the automation can load the page and reach the results. At this stage, just print the raw HTML to stdout — do not parse yet.

**Why second:** You need to observe the actual DOM before writing the parser. The page structure may differ from expectations. Inspect it hands-on before committing to a selector strategy.

**Risk:** Projudi may use dynamic rendering, iframes, or anti-bot patterns. Validate here before building parsing logic on top of assumptions.

### Step 3 — Parser (Day 2)

With raw HTML captured in Step 2, write the parser against real data. Use Playwright locators (preferred) or cheerio on the HTML string. Pin selectors to stable attributes (IDs, data attributes, structural position) not to text content, which can change.

**Why third:** Parser depends on understanding the actual DOM. Building it before Step 2 would mean guessing at selectors.

### Step 4 — Diff Detector (Day 2-3)

Implement `detectNew()`. This is pure logic — no I/O, no browser. Write it with a few inline test cases before integrating. The identity key strategy (composite vs. native ID) should be decided here based on what the parser was able to extract.

**Why fourth:** Depends on parser output shape being stable.

### Step 5 — Reporter (Day 3)

Implement stdout formatting. Keep it simple: one line per new movimentacao, prefixed by case number and date. No colors required for first version.

**Why fifth:** Last piece before the pipeline is complete. Easy to iterate on output format after the pipeline works end-to-end.

### Step 6 — Integration in index.js (Day 3)

Wire all components into the `for...of` loop in `index.js`. Run end-to-end against a real case number. Verify that state is persisted correctly and that a second run reports zero new entries (idempotency check).

**Why last:** Integration reveals gaps between components. All pieces must be independently stable before connecting them.

---

## Monorepo Growth Pattern

When a second automation is added:

1. Create a new top-level folder (e.g., `whatsapp-auto-reply/`).
2. Copy no code from `projudi-monitor/`. Each automation starts fresh.
3. Add a `README.md` to the new folder explaining its setup.
4. Update the root `README.md` index.

No shared library folder is needed until at least two automations independently solve the same problem in similar ways — only then extract a `shared/` or `lib/` folder. Premature sharing creates coupling that defeats the independence model.

---

## Sources

- Monorepo without tooling rationale: [The Node.js Monorepo Survival Guide](https://medium.com/@amirilovic/the-node-js-monorepo-survival-guide-84c7ad9b89ad)
- Playwright scraping patterns: [Playwright Web Scraping Tutorial 2026 — Oxylabs](https://oxylabs.io/blog/playwright-web-scraping)
- Court scraper architecture reference: [biglocalnews/court-scraper](https://github.com/biglocalnews/court-scraper)
- Playwright state persistence: [BrowserStack — Web Scraping with Playwright](https://www.browserstack.com/guide/playwright-web-scraping)
