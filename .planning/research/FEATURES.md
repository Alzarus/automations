# Features Research: Legal Process Monitor

**Domain:** Court case movement monitor (automated scraper/tracker)
**Target:** Projudi TJBA — consulta pública por teor
**Researched:** 2026-05-11
**Overall confidence:** HIGH (domain well-understood; specific Projudi fields are MEDIUM due to no public documentation)

---

## Table Stakes

Features the tool must have to be useful at all. Missing any of these and the tool
cannot fulfill its core value proposition.

| Feature | Why It Is Required | Complexity |
|---|---|---|
| **Accept a list of case numbers as input** | Without a configurable list, the tool hardcodes cases and is not reusable | Low |
| **Fetch current movements from Projudi** | Core action — no scrape means no data | Medium (Playwright navigation + form interaction) |
| **Parse movement list into structured records** | Raw HTML is not comparable; you need date, type, description per movement | Medium |
| **Persist known state per case between runs** | Without persistence, every run treats every movement as "new" — the tool is useless for change detection | Low (flat JSON file per case) |
| **Detect which movements are new since last run** | The core diff logic — compare current list against stored state | Low |
| **Print new movements to terminal** | The output contract stated in the requirements; without it the tool produces no visible result | Low |
| **Handle "no new movements" gracefully** | A clean run with nothing to report is a valid and expected outcome; panicking or printing nothing with no indication is confusing | Low |
| **Handle a case that returns no results** | Typo in case number, case moved to different system, or access denied — must not crash the whole batch | Low |
| **Idempotency on repeated runs** | Running twice with no new movements must produce the same state and no false positives | Low |
| **Timestamped last-checked field in state** | Required to know when the last successful check happened; needed for debugging and for cron audit | Low |

---

## Differentiators

Features that add genuine value without making the tool a different product. These are
deliberate choices, not scope creep. Each should be evaluated against the constraint
"does this justify its complexity in a single-purpose script?"

| Feature | Value It Adds | Complexity | Recommendation |
|---|---|---|---|
| **`--dry-run` flag** | Fetches and parses but does not write state; safe for debugging a new case number | Low | Build it — trivial flag, high debugging value |
| **`--case <number>` flag for one-off checks** | Run against a single case without editing the config file; useful for testing or spot-checks | Low | Build it — one conditional, reduces friction |
| **`--verbose` flag** | Prints all movements (not just new ones) plus HTTP timing; useful for debugging site changes | Low | Build it — already have the data, just gate the print |
| **Structured log file per run** | Writes a `logs/YYYY-MM-DD.log` file with the full terminal output; useful for auditing what was detected when | Low | Consider — adds zero logic, just `tee`-equivalent |
| **Configurable delay between cases** | Adds a sleep between fetches to avoid hammering the server; also mimics human pacing to reduce detection risk | Low | Build it — one `await sleep()` call, config-driven |
| **Exit code semantics** | Exit 0 = success (even with no new movements), exit 1 = at least one case failed to fetch | Low | Build it — makes cron alerting trivial |
| **Human-readable terminal output with case grouping** | Groups new movements under a case number header instead of a flat stream; reduces cognitive load | Low | Build it — formatting only, no logic change |
| **State backup before overwrite** | Before writing new state, copy old state to `state/<number>.json.bak`; allows manual rollback if parsing breaks | Low | Optional — useful if Projudi changes HTML structure |

---

## Anti-Features (Explicitly Exclude)

Features that are commonly found in tools of this type but add disproportionate complexity
for a single-purpose local utility. Excluding these is a deliberate architectural decision,
not an oversight.

| Anti-Feature | Why It Adds Complexity Without Proportional Value | What to Do Instead |
|---|---|---|
| **Email / WhatsApp / Telegram notifications** | Requires credentials management, third-party API integration, failure handling for delivery, and a separate config section. Already listed as out of scope. | Print to terminal. Pipe to a notification script later as a separate tool if ever needed. |
| **Web UI or dashboard** | A UI requires a server, routing, a frontend, and persistent hosting. This is a CLI utility. | `node index.js` is the UI. |
| **Database (SQLite, Postgres, etc.)** | A DB adds a dependency, a migration strategy, and a query layer for data that fits in a 2KB JSON file per case. | JSON files in `state/`. The data model is a list of movements — no joins, no aggregates needed. |
| **TypeScript** | Adds a compile step, `tsconfig.json`, type declaration management, and build complexity. The script is ~200 LOC. | JS with JSDoc comments where useful. |
| **Plugin or adapter architecture for multiple courts** | Abstractions for "any court" optimize for reuse that does not exist yet. YAGNI. | Hard-code Projudi. If TJAL or TJPE ever needs monitoring, create a separate folder per the monorepo design. |
| **Retry queue / job system** | A job queue (Bull, BullMQ, etc.) solves distributed concurrency. This script runs sequentially on one machine. | Simple sequential loop with a try/catch per case. If one case fails, log it and continue. |
| **Authentication / login flows** | The consulta pública por teor is intentionally public. Building login adds significant complexity (session cookies, token refresh, credential storage) with no benefit for the public endpoint. | Use the public endpoint only. |
| **Pagination handling beyond what Projudi shows by default** | If a case has 500 movements and Projudi shows the last 50, trying to fetch all history creates complexity (and likely blocks). | Store only what the public listing shows. The goal is detecting *new* movements, not archiving *all* history. |
| **Parallel fetching / concurrency** | Parallelizing requests to a government court site is the fastest way to get IP-blocked. The case list is small. | Sequential fetch with a configurable delay between cases. |
| **CAPTCHA solving** | The target endpoint (consulta por teor) is documented as not requiring CAPTCHA. If CAPTCHA appears on some paths, this signals the wrong endpoint is being used. | Stay on the public endpoint. If CAPTCHA appears unexpectedly, fail loudly rather than trying to bypass it. |
| **Self-updating / auto-upgrade mechanism** | Version management for a local script is unnecessary overhead. | Run `git pull` manually when updates are needed. |
| **Configuration validation / schema enforcement (Zod, Joi)** | A config file with 10 case numbers does not need a schema validator. | Document the expected format in a comment at the top of the config file. A clear error message when a field is missing is sufficient. |
| **Metrics / observability (Prometheus, Grafana)** | Operational monitoring belongs to production services handling thousands of requests. This is a personal utility. | Check the log file or terminal output. |

---

## Feature Dependencies

```
Read config file (case list)
  → Fetch movements for each case (Playwright)
    → Parse HTML into movement records
      → Load existing state from JSON (or treat as empty on first run)
        → Diff: current movements vs stored movements
          → Print new movements to terminal
            → Write updated state to JSON
```

The state write must happen AFTER the print. If the script crashes during print,
re-running is safe because state was not updated yet.

---

## MVP Recommendation

Build exactly what is described in PROJECT.md requirements and nothing more:

1. `processes.json` — list of case numbers to monitor
2. Playwright fetch + parse for each case
3. `state/<number>.json` — persist known movements + last-checked timestamp
4. Diff and print new movements
5. Configurable inter-case delay (one env var or config field)
6. `--dry-run` and `--verbose` flags (trivial to add, high debug value)
7. Graceful per-case error handling with continue-on-failure

Defer for a future milestone if validated by real use:
- Log file output (simple but not critical on day 1)
- State backup files (useful only after first Projudi HTML change breaks parsing)
- Notification hooks (separate script, separate folder)

---

## Sources

- [PacerMonitor Features](https://www.pacermonitor.com/features) — reference for what mature court monitoring tools consider essential
- [changedetection.io GitHub](https://github.com/dgtlmoon/changedetection.io) — open-source change monitor; minimal vs advanced feature distinction
- [court-scraper (biglocalnews)](https://github.com/biglocalnews/court-scraper) — court scraper framework; required vs optional scraper interface
- [Firecrawl: Web Scraping Mistakes](https://www.firecrawl.dev/blog/web-scraping-mistakes-and-fixes) — anti-patterns in scraper design
- [CourtListener Alerts](https://www.courtlistener.com/help/alerts/) — alert design reference for docket monitoring
- [Playwright + Cron best practices (Medium)](https://medium.com/@rijuldahiya/beyond-the-request-automating-data-extraction-with-playwright-and-cron-jobs-028dc6eaefeb) — scheduling and error handling patterns
