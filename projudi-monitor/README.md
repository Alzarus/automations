# projudi-monitor

CLI that monitors new movimentações on Projudi TJBA and prints them to the terminal.

## Requirements

- Node.js 18 or higher
- A `caseNumber` (teor hash) for each process to monitor — the hex string visible in the Projudi public search URL after submitting a case

## Installation

1. Clone or download this repository
2. `cd projudi-monitor`
3. `npm install` — installs Playwright and its Chromium browser (one-time, ~150 MB)
4. `npx playwright install chromium` — only needed if Playwright does not auto-install the browser during step 3

## Configuration

The process list lives in `config/processes.json`. This file is an array of objects, one per case to monitor.

**Fields:**

| Field | Required | Description |
|-------|----------|-------------|
| `caseNumber` | Yes | The teor hash for the case. Must be a lowercase hex string of at least 8 characters. Copy it directly from the Projudi URL after submitting the public search form. |
| `label` | No | Human-readable name printed in output alongside new movimentações. |

**Example `config/processes.json`:**

```json
[
  {
    "caseNumber": "1d49c1c15b8c",
    "label": "Processo Teste"
  }
]
```

Multiple processes can be listed in the array. The monitor runs them sequentially with a random delay between each case to avoid rate limiting. Add one object per case:

```json
[
  {
    "caseNumber": "1d49c1c15b8c",
    "label": "Processo Teste"
  },
  {
    "caseNumber": "a3f72e9b4d01",
    "label": "Segundo Processo"
  }
]
```

## Running

**Manual run:**

```
node index.js
```

The script opens a headless Chromium, navigates Projudi's public search for each configured case, compares the current movimentações against the last saved state, and prints only new entries to stdout. No output means nothing changed since the last run.

State is saved to `state/<caseNumber>.json` (one file per case, gitignored).

**Flags:**

| Flag | Effect |
|------|--------|
| `--dry-run` | Queries Projudi and shows the diff but does NOT update state files. Safe for testing without advancing the saved state. |
| `--verbose` | Prints navigation steps, frame URLs, row counts, and timing to stdout. Useful for debugging connectivity or selector issues. |

Flags can be combined:

```
node index.js --dry-run --verbose
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | All cases processed successfully |
| 1 | At least one case failed (error logged per case; remaining cases still processed) |

When exit code is 1, look for `[ERROR]` lines in the output to identify which case failed and why.

## Scheduling

The script has no built-in scheduler. Use your OS scheduler to run it on a recurring interval.

### Linux — cron

Open your crontab with:

```
crontab -e
```

Add a line to run every 30 minutes and append output to a log file:

```
*/30 * * * * cd /absolute/path/to/projudi-monitor && node index.js >> /absolute/path/to/projudi-monitor/monitor.log 2>&1
```

Instructions:
- Replace `/absolute/path/to/projudi-monitor` with the real path on your machine (run `pwd` inside the `projudi-monitor` folder to get it)
- Change `*/30` to adjust frequency — for example, `0 */2 * * *` runs every 2 hours
- The `>> ... 2>&1` redirects both stdout and stderr to a log file so you can review output later

### Windows — Task Scheduler

Step-by-step using the Task Scheduler UI (no PowerShell required):

1. Open **Task Scheduler** (search for it in the Start menu)
2. Click **Create Basic Task** in the Actions panel on the right
3. **Name:** `Projudi Monitor` — click Next
4. **Trigger:** choose **Daily** — click Next; set the start time; tick **Repeat task every** `30 minutes` for a duration of **1 day** — click Next
5. **Action:** choose **Start a program** — click Next
6. **Program/script:** enter the full path to `node.exe` (find it by running `where node` in Command Prompt, e.g. `C:\Program Files\nodejs\node.exe`)
7. **Add arguments:** `index.js`
8. **Start in:** full path to the `projudi-monitor` folder (e.g. `C:\Users\YourName\projudi-monitor`)
9. Click **Finish**

**To capture output to a log file**, change step 6 to use `cmd.exe` with these arguments:

```
/c "node index.js >> C:\path\to\projudi-monitor\monitor.log 2>&1"
```

And set **Start in** to the `projudi-monitor` folder path.

## State files

State is stored in `state/<caseNumber>.json` — one file per case. These files are gitignored and created automatically on the first successful run.

Deleting a state file causes the next run to treat all existing movimentações as new (they will all be printed). This is intentional for resetting a case. If you want to preview what would be printed without actually saving state, use `--dry-run` first.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `[ERROR] ...: AcessoPublico frame not found` | Projudi site was slow or temporarily down | Wait a few minutes and retry |
| `[ERROR] ...: No movimentacao rows found` | The case has no Eventos do Processo yet, or the teor hash is wrong | Verify the `caseNumber` in `config/processes.json` |
| `[ERROR] ...: Invalid caseNumber` | `caseNumber` is not a lowercase hex string of at least 8 characters | Copy the teor hash directly from the Projudi URL |
| Script exits with code 1 but some cases print output | At least one case failed; others succeeded | Check `[ERROR]` lines in the output |
| No output at all | Nothing new since the last run, or all cases failed silently | Run with `--verbose` to see what is happening |
