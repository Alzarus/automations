# Pitfalls Research: Court Site Browser Scraping

**Project:** projudi-monitor (Projudi TJBA — consulta pública por teor)
**Stack:** Node.js + Playwright, plain JS, JSON state files
**Researched:** 2026-05-11
**Confidence:** MEDIUM — Projudi-specific behavior unverifiable without live access; general Playwright/Node.js pitfalls are HIGH confidence from official sources and confirmed issues.

---

## Critical Pitfalls

### 1. Headless Browser Fingerprinting — Silent Blocking Without CAPTCHA

**What goes wrong:**
Even though the "consulta por teor" path has no CAPTCHA, Projudi runs on Java-based court middleware (common in Brazilian judiciary systems) that may still fingerprint the browser. The two most reliable signals are `navigator.webdriver = true` (set by every Playwright/Selenium instance per the W3C WebDriver spec) and the absence of realistic browser plugins/languages arrays. A site does not need Cloudflare or DataDome to implement a simple JS check that silently returns empty results, stalls indefinitely, or redirects instead of throwing a visible error.

**Why it happens:**
Playwright in default headless mode exposes multiple automation indicators. The `navigator.webdriver` property is `true`. The `navigator.plugins` list is empty. The `navigator.languages` array is often minimal. These are detectable with a 5-line JS snippet any backend developer can add to the page without any third-party service.

**Consequences:**
The script appears to work — page loads, no error thrown — but scrapes empty results or stale data silently. You accumulate a state file full of zero movements and only discover the problem weeks later when a real movement is missed.

**Warning signs:**
- Querying a process number you know has recent movements returns zero results
- The result element exists in the DOM but is empty
- Running the same query manually in a real browser returns data; the script returns nothing
- Inconsistent results: sometimes data appears, sometimes not (intermittent JS-level checks)

**Prevention:**
- Add `playwright-extra` + `puppeteer-extra-plugin-stealth` at project start. The Node.js package is stale (last released March 2023) but still handles the most common checks (`navigator.webdriver`, plugins, languages).
- Set a realistic `userAgent` explicitly — Playwright's default headless UA is a known fingerprint.
- Add `--disable-blink-features=AutomationControlled` to Chromium launch args.
- Run in headed mode (`headless: false`) during development to verify results match what a real browser sees. Add a `DEBUG=true` env flag to keep it headed in dev.
- After scraping, always assert that the result container has at least one child element. If it's empty, treat it as a potential blocking event, not a real "no movements" result — unless the case is genuinely new.

**Phase to address:** Phase 1 (initial implementation). Do not defer — a script that silently returns wrong data is worse than one that visibly fails.

---

### 2. Selector Rot — HTML Changes Break Scraping Silently

**What goes wrong:**
Projudi is a JSF/Java EE application. JSF generates dynamic component IDs like `j_id_3:j_id_47:resultTable`. These IDs regenerate when the page template changes — a minor UI update on the court's end (new menu item, reordered panels, Java EE upgrade) silently changes every generated ID on the page. CSS class selectors tied to presentation (`.resultadoBusca`, `.dadosProcesso`) break whenever the court rebrands or patches the UI.

**Why it happens:**
Brazilian court systems are maintained by state IT departments on irregular schedules. TJBA has had at least one major Projudi version (the manual PDF in their downloads is versioned). There is no commitment to stable HTML structure — it is an internal admin tool, not a public API.

**Consequences:**
Selectors that worked last month silently stop matching. The scraper either throws a `TimeoutError` (if using `waitForSelector`) or returns `null`/`undefined` and writes empty data to state files. If not caught, state files record "no new movements" permanently.

**Warning signs:**
- `page.waitForSelector(selector)` starts timing out after working for weeks
- The state file's `lastChecked` timestamp updates but `movements` array stops growing
- Manual inspection of the page shows the data is there but at a different DOM path

**Prevention:**
- Never use JSF-generated IDs (`j_id_*`). Target by text content, structural role, or stable attributes.
- Prefer `page.getByText('Movimentações')`, `page.locator('table:has(th:text("Data"))')`, and similar semantic selectors over positional CSS.
- For table data, target by column header text, not column index: find the `<th>` with the expected label, then extract the corresponding `<td>` by position. This survives column reordering.
- Add a "sanity selector" — a known stable element (e.g., the site logo or a fixed heading) — and assert it exists before proceeding. If it's missing, the page structure has changed fundamentally.
- Log the full outer HTML of the result container to a `debug/` folder on each run in development. Diffing two runs reveals structure changes instantly.

**Phase to address:** Phase 1. Build with resilient selectors from the start; retrofitting selector strategy onto a finished scraper is a rewrite of the core logic.

---

### 3. State File Corruption on Interrupted Writes

**What goes wrong:**
Node.js `fs.writeFileSync` and `fs.writeFile` are not atomic on any OS. If the process is killed (Ctrl+C, Windows Task Scheduler timeout, OOM kill, power loss) mid-write, the JSON file is left in a partially written state. On the next run, `JSON.parse()` throws a `SyntaxError`, the script crashes before reading any data, and all tracked state for that process is lost. In the worst case, if the script catches the error poorly, it overwrites the corrupt file with an empty object, silently losing all movement history.

**Why it happens:**
`fs.writeFileSync` opens the file, truncates it, then writes. Any interruption between truncate and flush-to-disk leaves a truncated (empty or partial) file. This is a documented Node.js issue (nodejs/node#1058). Cron-based scripts are especially vulnerable because Task Scheduler on Windows kills processes at hard deadlines without any cleanup signal.

**Consequences:**
Loss of the "known movements" baseline. On the next successful run, all existing movements appear as "new" and flood the terminal output. Worse, if the script is used to trigger downstream actions (future: notifications), this causes false positives for every historical movement.

**Warning signs:**
- `JSON.parse` crash on startup with `SyntaxError: Unexpected end of JSON input`
- State file size is 0 bytes or contains a partial JSON string
- The file's last-modified timestamp matches the time of a known interruption (cron deadline, manual kill)

**Prevention:**
- Use write-then-rename (atomic swap): write to `state/<number>.json.tmp`, then `fs.renameSync` to `state/<number>.json`. Rename is atomic on both Linux and Windows (same drive). This is the same pattern used by databases, editors, and package managers.
- Before parsing any state file, wrap `JSON.parse` in try/catch. On parse failure: log a warning, back up the corrupt file to `state/<number>.json.corrupt.<timestamp>`, and start from an empty state for that process.
- Keep a backup: after every successful write, copy the new file to `state/<number>.json.bak`. Recovery path: if `.json` is corrupt and `.bak` is valid, restore from `.bak`.
- Use `write-file-atomic` npm package if you prefer not to implement this manually — it handles the temp-file-then-rename pattern and fsync.

**Phase to address:** Phase 1. Atomic writes are a two-line change; add them before the first real run.

---

### 4. Encoding Corruption — Portuguese Characters and Dates

**What goes wrong:**
Projudi (and many Brazilian government systems of that generation) may serve pages with `Content-Type: text/html; charset=ISO-8859-1` or `windows-1252` rather than UTF-8. Playwright operates in UTF-8 internally, but if the page's declared encoding mismatches what the server actually sends, accented characters (`ã`, `ç`, `é`, `ô`, `ú`) appear as `Ã£`, `Ã§`, `Ã©` in extracted text. Dates in Brazilian format (`DD/MM/AAAA`) stored as strings are non-issues as long as you treat them as opaque strings — but code that tries to parse them with `new Date()` silently produces `Invalid Date` (JS `Date` constructor expects ISO format by default).

**Why it happens:**
Projudi is a legacy system. Many Brazilian court systems were built before UTF-8 was universal in Java EE environments. The HTML `<meta charset>` tag may claim one encoding while the HTTP header claims another; browsers reconcile this with heuristics, but Playwright's `page.textContent()` uses whatever the browser resolved.

**Consequences:**
Movement descriptions stored in JSON contain garbage characters. Text-based deduplication (comparing new movements to known ones) fails because `"Conclusos à MM."` stored as `"Conclusos Ã  MM."` never matches the correct string, creating duplicate entries on every run.

**Warning signs:**
- JSON state files contain `Ã`, `Â`, or `â€` sequences where accented characters should be
- Movement descriptions that contain `ç`, `ã`, `ê` look corrupted in the terminal
- Two movements that appear identical in the browser are recorded as different entries in state

**Prevention:**
- After loading the page, check `document.characterSet` via `page.evaluate(() => document.characterSet)`. Log it on first run.
- If the site serves ISO-8859-1, Playwright's Chromium will typically transcode correctly for `textContent()` calls — but verify by spot-checking a known accented string against what's in the DOM.
- Store all movement text as-is from `textContent()` without further encoding manipulation. Do not pass through `Buffer.from(str, 'latin1').toString('utf8')` unless you have confirmed a raw binary encoding problem.
- For deduplication keys, normalize: `str.normalize('NFC').trim()`. NFC normalization collapses different Unicode representations of the same character (e.g., `é` as single codepoint vs. `e` + combining accent).
- Store dates as the raw string from the site (`"11/05/2026"`) in JSON. Only parse them for sorting/comparison using a library like `date-fns` with explicit locale, never `new Date("11/05/2026")`.

**Phase to address:** Phase 1, during first integration test against the real site. Write an encoding assertion into the smoke test.

---

### 5. Rate Limiting and IP Blocking From Rapid Sequential Requests

**What goes wrong:**
A script that queries 20 case numbers in a tight loop sends 20 requests to the same government server in seconds. Even without a commercial anti-bot service, Brazilian court systems run on modest infrastructure and often have network appliances (F5, Nginx upstreams, or ISP-level DDoS protection) configured with per-IP rate limits in the hundreds of requests per minute. When the limit is hit, the server may return HTTP 429, silently return an empty page, hang the connection, or — most insidiously — begin returning HTTP 200 with a "session expired" or maintenance page that looks like a valid HTML response.

**Why it happens:**
Government infrastructure is not built for automation traffic. A single Playwright browser session making back-to-back full-page loads (each triggering JS, CSS, fonts, images) can look like a DoS attempt to a poorly configured firewall.

**Consequences:**
Partial runs: the first 5 processes are scraped, the rest silently return nothing. State files for later processes are updated with empty movement lists, losing the real baseline.

**Warning signs:**
- Script succeeds for the first N processes but consistently fails for the rest
- Network tab (in headed mode) shows TCP connection resets or very long waits after the Nth request
- Running with `--slowMo` reveals the requests succeed when spaced out

**Prevention:**
- Add a configurable `DELAY_BETWEEN_CASES` (default: 3000ms) between each case query. Three seconds per case means 20 cases take 60 seconds — perfectly acceptable for a cron job.
- Randomize the delay: `delay + Math.random() * 2000`. Uniform intervals are more detectable than jittered ones.
- Process cases sequentially, not concurrently. `Promise.all()` with 20 browser contexts is both overkill and the fastest way to trigger a block.
- On HTTP error or empty-result detection, implement exponential backoff with a max of 3 retries before marking the case as `status: "fetch_failed"` in state and continuing to the next one.
- Log the HTTP status of the navigation response: `const response = await page.goto(url); console.log(response.status())`. A 200 that returns a maintenance page is caught by the empty-result sanity check (Pitfall 2), not here — but non-200 responses should be logged explicitly.

**Phase to address:** Phase 1 (built into the query loop from the start). Delay is a one-liner; not adding it is the risk.

---

### 6. Orphaned Browser Processes on Windows (Cron / Task Scheduler)

**What goes wrong:**
When a Playwright script crashes or is killed by Task Scheduler before `browser.close()` is called, Chromium child processes remain running in the background. On Windows, these are not automatically cleaned up by the OS when the Node.js parent exits abnormally. After several failed runs, the machine accumulates dozens of orphaned `chrome.exe` processes consuming RAM. Eventually, the next scheduled run fails to launch a new browser instance due to resource exhaustion or port conflicts.

**Why it happens:**
Playwright spawns Chromium as a child process and communicates via WebSocket (CDP). If the Node.js process is terminated without running cleanup code, the Chromium process has no parent signal to exit. On Linux, the OS typically reaps orphans when the parent dies; Windows does not have this behavior for all process types. This is a documented Playwright issue (microsoft/playwright#34190, microsoft/playwright-dotnet#1749).

**Consequences:**
Growing RAM usage on the host machine. Eventually, the script fails on launch. On a laptop, this drains battery. On a server, it can cause OOM.

**Warning signs:**
- Task Manager shows multiple `chrome.exe` processes when the script is not running
- RAM usage increases monotonically after each cron run
- Script starts failing with launch errors after a week of scheduled runs

**Prevention:**
- Wrap the entire script in a try/catch/finally block. The `finally` block must call `await browser.close()`. This runs even if the script throws.
- Register a `process.on('SIGTERM', cleanup)` and `process.on('SIGINT', cleanup)` handler where `cleanup` calls `browser.close()` then `process.exit(0)`. Task Scheduler sends SIGTERM before force-killing on Windows (via `taskkill`).
- Set a hard timeout on the entire script run. If the script takes more than N minutes (e.g., `setTimeout(() => { cleanup(); process.exit(1); }, MAX_RUNTIME_MS)`), force-exit cleanly. N should be `(number_of_cases * delay_between_cases * 3)` with a safety multiplier.
- On Windows, add a Task Scheduler pre-action or a separate cleanup script: `taskkill /F /IM chrome.exe /FI "USERNAME eq <user>"` before the main task runs, to kill any leftover instances from the previous failed run. This is a blunt approach but reliable.
- Use `{ timeout: 30000 }` on `page.goto()` and all `waitForSelector()` calls. Never let a single page navigation hang indefinitely.

**Phase to address:** Phase 1 for the try/finally pattern; Phase 2 (cron integration) for the process-level signal handlers and the hard timeout.

---

### 7. LGPD and Legal Exposure From Storing Personal Data

**What goes wrong:**
Court movement records from Projudi may include names of parties (plaintiffs, defendants), CPF references, and other personal identifiers. Brazil's LGPD (Lei Geral de Proteção de Dados — Lei 13.709/2018) applies to all personal data processing, including that done by individuals and for personal purposes, though enforcement has so far focused on commercial actors. The critical risk is not scraping public data — it is storing, aggregating, and potentially sharing it. A Brazilian court filed a public civil action against a company for aggregating data scraped from public sources into a searchable database.

**Why it matters for this project:**
The stated use case is monitoring your own (or a client's) cases for new movements. That is clearly legitimate. The risk surface is: (a) the state JSON files are stored on disk and could be accessed by others; (b) if the monitored case list grows to third-party cases, the legal basis becomes less clear; (c) if the tool is distributed or offered as a service, it becomes a data aggregation product under LGPD.

**Warning signs:**
- The config file contains processes belonging to many different parties (not just the operator's)
- State files are stored in a shared or cloud-synced directory without access controls
- The tool is shared with others who use it to monitor cases they are not parties to

**Prevention:**
- Store state files locally only, with OS-level file permissions restricting access.
- Do not log full party names or CPF fragments to console output — log only the process number and the movement date/type.
- Add a comment in the config file noting that the tool is intended for monitoring cases the operator is a party to or has legal standing to monitor.
- If the tool is ever extended to a service or shared script, consult LGPD compliance requirements before distributing.
- Data minimization: store only what is needed for deduplication (movement date + first N characters of description as a hash key, not full text). This is the LGPD principle of `minimização de dados`.

**Phase to address:** Phase 1 design (what to store in state files). Not a blocker, but influences state file schema from the start.

---

## Phase Mapping

| Phase | Pitfall | What to Implement |
|-------|---------|-------------------|
| Phase 1 — Core implementation | #1 Headless fingerprinting | `playwright-extra` + stealth plugin; realistic UA; headed debug mode; empty-result assertion |
| Phase 1 — Core implementation | #2 Selector rot | Semantic selectors (text/role-based); sanity selector; debug HTML dump |
| Phase 1 — Core implementation | #3 State file corruption | Atomic write (write-tmp + rename); JSON parse guard with backup/restore |
| Phase 1 — Core implementation | #4 Encoding corruption | `document.characterSet` assertion in smoke test; NFC normalization; opaque date strings |
| Phase 1 — Core implementation | #5 Rate limiting | Sequential processing; configurable delay (default 3s) with jitter; retry with backoff; HTTP status logging |
| Phase 1 — Core implementation | #7 LGPD/data minimization | State schema design: store hashes or minimal fields; restrict console output of PII |
| Phase 2 — Cron integration | #6 Orphaned processes | try/finally with `browser.close()`; SIGTERM/SIGINT handlers; hard script timeout; Windows pre-task cleanup |

---

## Appendix: Anti-Patterns to Avoid

**Do not use `waitForTimeout(N)` as your primary wait strategy.**
`page.waitForTimeout()` is explicitly called out in Playwright docs as inappropriate for production scrapers. Use `page.waitForSelector()`, `page.waitForResponse()`, or `page.waitForLoadState('networkidle')` instead. Fixed waits make the script slow and still fail on slow network days.

**Do not silently swallow errors.**
A `try/catch` that does nothing on failure is worse than no error handling. At minimum: log the error with process number and timestamp, mark that process as `status: "error"` in state, and continue to the next. A script that crashes silently and marks nothing as failed gives you no signal that monitoring has stopped.

**Do not assume empty results mean no movements.**
An empty result container is ambiguous — it could mean: no movements exist, the site is blocking you, the selector broke, or a network timeout occurred. Always distinguish between "got a page with an explicit empty-state message" (the site shows 'Nenhum resultado encontrado') and "got a page where the result container is missing entirely."

**Do not run concurrent Playwright contexts for this use case.**
The performance gain is marginal (the bottleneck is the site's response time and your intentional delay), and the risk of IP-level blocking increases with request concurrency. Sequential is correct here.

---

## Sources

- [How To Make Playwright Undetectable — ScrapeOps](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-make-playwright-undetectable/)
- [Playwright Bot Detection: What Works in 2026 — AlterLab](https://alterlab.io/blog/playwright-bot-detection-what-actually-works-in-2026)
- [Playwright Stealth: Bypass Bot Detection in Python & Node.js — Scrapfly](https://scrapfly.io/blog/posts/playwright-stealth-bypass-bot-detection)
- [playwright-extra — npm](https://www.npmjs.com/package/playwright-extra)
- [How to detect Headless Chrome bots instrumented with Playwright — Castle.io](https://blog.castle.io/how-to-detect-headless-chrome-bots-instrumented-with-playwright/)
- [fs.writeFileSync may corrupt files upon partial write — nodejs/node#1058](https://github.com/nodejs/node/issues/1058)
- [write-file-atomic — npm](https://www.npmjs.com/package/write-file-atomic)
- [When Code Collides: Prevent Data Loss in Node.js Apps with Cron Jobs — DEV Community](https://dev.to/yasir_rafique_27550feb631/when-code-collides-how-to-prevent-data-loss-in-nodejs-apps-with-cron-jobs-and-api-calls-2l3n)
- [Zombie process — Playwright Issue #34190](https://github.com/microsoft/playwright/issues/34190)
- [Chrome process remains after close — Playwright Python Issue #984](https://github.com/microsoft/playwright-python/issues/984)
- [LGPD — Data Protection Laws and Regulations Brazil 2025-2026 — ICLG](https://iclg.com/practice-areas/data-protection-laws-and-regulations/brazil)
- [Data Protection in Brazil: Applying Text Mining in Court Documents — MDPI](https://www.mdpi.com/2673-4591/87/1/57)
- [Playwright Selector Best Practices — BrowserStack](https://www.browserstack.com/guide/playwright-selectors-best-practices)
- [Playwright Locators — Official Docs](https://playwright.dev/docs/locators)
- [Fix Encoding Bugs in Web Scraping — Forage.ai](https://forage.ai/blog/character-encoding-bugs-web-scraping-guide/)
- [Web Scraping: Handling Failed Requests and Retries — ScrapeOps](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-beginners-guide-part-4/)
