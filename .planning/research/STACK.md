# Stack Research: Browser Automation Monorepo

**Project:** automations / projudi-monitor
**Researched:** 2026-05-11
**Overall confidence:** HIGH for core stack, MEDIUM for headless detection risk on Projudi

---

## Recommended Stack

| Tool | Version | Purpose | Confidence |
|------|---------|---------|------------|
| `playwright` | `^1.60.0` | Browser automation — page navigation, DOM extraction | HIGH |
| `node-cron` | `^4.2.1` | In-process scheduled execution (optional — OS cron is preferred for simplicity) | HIGH |
| `fs/promises` (Node built-in) | Node 18+ | JSON state read/write — no extra dependency needed | HIGH |
| npm workspaces | built-in (npm 7+) | Monorepo workspace linking without extra tooling | HIGH |

No build tools, no TypeScript compiler, no ORM — plain `.js` files run directly with `node`.

---

## Key Rationale

### Playwright over Puppeteer

Playwright (`^1.60.0`) is the correct choice. Both are actively maintained in 2025, but Playwright wins on every axis that matters for this project:

- **Multi-browser by default.** Playwright ships Chromium, Firefox, and WebKit bundled. If Projudi detects Chrome's headless fingerprint, switching to Firefox takes one flag change (`channel: 'firefox'`). Puppeteer is Chrome/Chromium-only.
- **Cleaner API.** `page.locator()`, `page.waitForSelector()`, and `page.evaluate()` are stable and predictable. Puppeteer's API has more footguns around timing.
- **Actively maintained by Microsoft.** Playwright hit `1.60.0` as of the research date; Puppeteer is at `24.x` but has historically been slower to ship features.
- **StorageState API** (added in 1.51) lets you save and restore browser session state, useful if the scraper ever needs to persist cookies between runs.
- The project's own `PROJECT.md` already lists Playwright as the decided tool — this research confirms that decision is correct.

**Puppeteer's only advantage** is its stealth plugin ecosystem being marginally more battle-tested. That is irrelevant here because Projudi is a Brazilian government judicial portal with no observed advanced anti-bot measures (no Cloudflare, no reCAPTCHA on the public search endpoint). See the headless detection section below.

### Headless mode: safe with minimal precautions

Projudi TJBA uses a legacy Java-based judicial system (PJe/Projudi stack common across Brazilian courts). The public "consulta por teor" endpoint is intentionally public-access — it is used by lawyers, parties, and the general public without credentials. These systems do not deploy Cloudflare Bot Management or sophisticated fingerprinting.

**Recommended headless configuration:**

```js
const browser = await chromium.launch({
  headless: true,
  args: ['--disable-blink-features=AutomationControlled'],
});
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 720 },
  locale: 'pt-BR',
});
```

This eliminates the most obvious headless markers (the `navigator.webdriver` flag and the HeadlessChrome User-Agent string) without needing `playwright-extra` or the stealth plugin. If blocking does occur in the future, add `playwright-extra` + `puppeteer-extra-plugin-stealth` — but do not add this complexity preemptively.

**Do NOT add stealth plugins now.** `playwright-extra` (`4.3.6`) and `puppeteer-extra-plugin-stealth` (`2.11.2`) have both had their last publish in 2023. They are lightly maintained. For a government court portal that has no anti-bot system, this dependency is dead weight.

### Scheduler: OS cron over node-cron (with node-cron as fallback)

**First choice: OS cron / Task Scheduler.**
For a local monitoring script that runs on a single machine, the operating system scheduler is superior:

- No process stays alive between runs — lower memory, no crash risk, no "silent death" problem.
- On Windows: Task Scheduler or WSL cron. On Linux/Mac: native crontab.
- The script stays a simple `node index.js` with no daemon complexity.

**Second choice: node-cron `^4.2.1`** if keeping a persistent Node process is preferred.
node-cron is at `4.2.1` (last published April 2026 — actively maintained), has ~3M weekly downloads, and uses standard cron syntax. It is the simplest in-process option. Add it only if OS-level scheduling is impractical.

**Do not use Croner or node-schedule** for this project. Croner is better for production distributed systems where silent failure matters critically. This scraper prints to stdout and persists state in JSON — a failed run is visible when the user checks. The additional dependency is not justified.

### State management: `fs/promises` built-in, no libraries

Use Node's built-in `fs/promises` module. The pattern is straightforward:

```js
import { readFile, writeFile, mkdir } from 'fs/promises';

async function loadState(caseNumber) {
  try {
    const raw = await readFile(`./state/${caseNumber}.json`, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastChecked: null, knownMovements: [] };
  }
}

async function saveState(caseNumber, state) {
  await mkdir('./state', { recursive: true });
  await writeFile(`./state/${caseNumber}.json`, JSON.stringify(state, null, 2));
}
```

No `fs-extra`, no `lowdb`, no `conf` package — they add surface area for a 10-line pattern.

### Monorepo structure: npm workspaces, flat

For a collection of independent utility scripts (not shared-library applications), use npm workspaces in the simplest possible configuration. Do NOT use Turborepo, pnpm, or Nx — those tools are for teams with multiple interdependent apps sharing packages. This is a solo utility monorepo.

**Recommended folder layout:**

```
automations/
  package.json          ← root workspace config
  .planning/
  automations/
    projudi-monitor/
      package.json      ← { "name": "projudi-monitor", "type": "module" }
      index.js          ← entry point
      scraper.js        ← page interaction logic
      state.js          ← JSON read/write helpers
      processes.json    ← config: list of case numbers to monitor
      state/            ← auto-created: one .json per case number
    [future-automation]/
      package.json
      index.js
```

Root `package.json`:

```json
{
  "name": "automations",
  "private": true,
  "workspaces": ["automations/*"],
  "scripts": {
    "projudi": "node automations/projudi-monitor/index.js"
  }
}
```

Each automation is independently runnable (`cd automations/projudi-monitor && node index.js`) and also callable from root (`npm run projudi`). No build step, no compilation, no shared packages to wire up.

---

## What NOT to Use

| Tool | Why Not |
|------|---------|
| **Puppeteer** | Chrome-only; Playwright is strictly better for this use case with no tradeoffs |
| **Cheerio + axios** | Projudi is a dynamic Java web app — the DOM is rendered or manipulated client-side; HTTP-only scraping will miss content or hit session walls |
| **Selenium / WebdriverIO** | Legacy tooling; slower, more brittle, larger install footprint; no advantage over Playwright |
| **playwright-extra + stealth plugin** | Both last published 2023, lightly maintained; unnecessary for a public government portal without anti-bot measures; add only if blocking occurs |
| **Croner / node-schedule** | Justified only for production distributed systems; over-engineered for a local utility script |
| **Turborepo / Nx / pnpm workspaces** | Designed for teams and multi-app codebases with shared packages; npm workspaces is sufficient and has zero additional tooling to learn |
| **lowdb / conf / nedb** | Libraries for JSON state management where `fs/promises` + `JSON.parse/stringify` is 10 lines |
| **TypeScript** | PROJECT.md explicitly rules this out; correct call for simple scripts — adds compilation step for zero runtime benefit |
| **Dotenv / .env files** | Configuration is a plain `processes.json` array; env variables are not needed |

---

## Confidence Notes

| Area | Confidence | Notes |
|------|------------|-------|
| Playwright over Puppeteer | HIGH | Verified current versions (1.60.0 vs 24.x), multi-browser advantage confirmed via official release notes and multiple sources |
| Headless safety on Projudi | MEDIUM | Could not directly inspect Projudi's HTTP headers or confirm absence of anti-bot middleware; assessment is based on (a) the system being a Brazilian judicial portal with a public endpoint, (b) no Cloudflare results in targeted search, (c) historical pattern of PJe/Projudi systems being legacy Java stacks without bot protection. First run should be done headed (`headless: false`) to confirm behavior. |
| node-cron maintenance status | HIGH | Confirmed `4.2.1` published April 2026 via npm registry — actively maintained |
| playwright-extra stealth | HIGH (to avoid) | Last publish April 2023 confirmed via npm registry — not recommended |
| npm workspaces for monorepo | HIGH | Built-in to npm 7+, no extra install; appropriate scope for this project |
| fs/promises for state | HIGH | Node built-in, stable since Node 14, no external dependency risk |

---

## Sources

- [Playwright npm package](https://www.npmjs.com/package/playwright) — confirmed version 1.60.0
- [Playwright v1.51.0 Release Notes](https://github.com/microsoft/playwright/releases/tag/v1.51.0) — StorageState, filter visible elements
- [Playwright Release Notes (official)](https://playwright.dev/docs/release-notes)
- [Playwright vs Puppeteer (BrowserCat)](https://www.browsercat.com/post/playwright-vs-puppeteer-web-scraping-comparison)
- [Playwright vs Puppeteer (ScraperAPI)](https://www.scraperapi.com/blog/playwright-vs-puppeteer/)
- [Making Playwright Undetectable (ScrapeOps)](https://scrapeops.io/playwright-web-scraping-playbook/nodejs-playwright-make-playwright-undetectable/)
- [Playwright Stealth — Bright Data](https://brightdata.com/blog/how-tos/avoid-bot-detection-with-playwright-stealth)
- [node-cron vs node-schedule vs Croner (PkgPulse)](https://www.pkgpulse.com/blog/node-cron-vs-node-schedule-vs-croner-task-scheduling-nodejs-2026)
- [Comparing Node.js schedulers (LogRocket)](https://blog.logrocket.com/comparing-best-node-js-schedulers/)
- [npm Workspaces Monorepo Guide](https://reintech.io/blog/npm-workspaces-monorepo-management-guide)
