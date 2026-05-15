'use strict';

const { chromium } = require('playwright');
const { writeFileSync, renameSync, mkdirSync, readFileSync } = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
const BASE_URL = 'https://projudi.tjba.jus.br/projudi/';
const STATE_DIR = path.join(__dirname, 'state');
const CONFIG_PATH = path.join(__dirname, 'config', 'processes.json');

// Delay between consecutive case requests (CFG-02, CLAUDE.md — sequential only, no parallel)
const BASE_DELAY_MS = 3000;
const JITTER_MS = 2000; // adds 0-2000ms random additional delay

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Build a stable deduplication ID from date + description (D-06, PARS-03) */
function makeId(date, description) {
  return date.normalize('NFC').trim() + '|' + description.normalize('NFC').trim();
}

/** Validate caseNumber before using in file paths (T-01-01 path traversal) */
function validateCaseNumber(caseNumber) {
  if (!/^[a-f0-9]{8,}$/.test(caseNumber)) {
    throw new Error('Invalid caseNumber: ' + caseNumber);
  }
}

/** Read persisted state for a case. Returns default if file not found. */
function loadState(caseNumber) {
  const target = path.join(STATE_DIR, caseNumber + '.json');
  try {
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return { lastChecked: null, movimentacoes: [] };
  }
}

/** Atomic state write: write to .tmp then renameSync (T-01-02, STATE-02) */
function saveState(caseNumber, data) {
  mkdirSync(STATE_DIR, { recursive: true });
  const target = path.join(STATE_DIR, caseNumber + '.json');
  const tmp = target + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  renameSync(tmp, target);
}

// ---------------------------------------------------------------------------
// SCRAPER
// Confirmed selectors (live DOM inspection 2026-05-15):
//   - Homepage uses HTML frameset; main content is in frame PaginaPrincipal.jsp
//   - Form `formAcessoPublico` (id="codigoHash") submits to /projudi/AcessoPublico
//   - The "Consulta Pública" button shown in the manual is NOT a standalone button;
//     the section uses multiple forms. formAcessoPublico is the teor-hash entry.
//   - Result loads in a new frame at URL /projudi/AcessoPublico (not top-level page)
//   - Section heading is "Eventos do Processo" (NOT "Etapas do Processo" as assumed in RESEARCH.md)
//   - XPath: //table[.//text()[contains(., "Eventos do Processo")]]//tr → returns all rows
//   - Rows with exactly 7 cells are data rows; others are headers/separators
//   - Column order in data rows (7-cell): [0]=nº, [1]=description, [2]=date DD/MM/YY, [3]=movedBy, [4-6]=file extras
// ---------------------------------------------------------------------------

async function scrapeCase(page, caseNumber, flags) {
  validateCaseNumber(caseNumber);

  if (flags.verbose) console.log('[verbose] Navigating to', BASE_URL);

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for network to settle so JSF frames finish loading (networkidle = 500ms quiet)
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    // networkidle may never fire on slow government sites — continue if it times out
  });

  // Find the main frame (PaginaPrincipal.jsp)
  const mainFrame = page.frames().find(f => f.url().includes('PaginaPrincipal'));
  if (!mainFrame) {
    throw new Error('Main frame (PaginaPrincipal.jsp) not found — page layout may have changed');
  }

  if (flags.verbose) console.log('[verbose] Main frame found:', mainFrame.url());

  // Fill the teor hash into formAcessoPublico
  await mainFrame.fill('#codigoHash', caseNumber);
  if (flags.verbose) console.log('[verbose] Filled codigoHash:', caseNumber);

  // Submit form — loads result in a new AcessoPublico frame
  await mainFrame.evaluate(() => { document.formAcessoPublico.submit(); });

  // Wait for AcessoPublico frame to appear
  await sleep(3000);

  // Locate the AcessoPublico frame
  let accessFrame = page.frames().find(f => f.url().includes('AcessoPublico'));
  if (!accessFrame) {
    // Wait a bit more if not immediately available
    await sleep(4000);
    accessFrame = page.frames().find(f => f.url().includes('AcessoPublico'));
  }
  if (!accessFrame) {
    throw new Error('AcessoPublico frame not found after form submit — page may have changed');
  }

  if (flags.verbose) console.log('[verbose] AcessoPublico frame found:', accessFrame.url());

  // Wait for "Eventos do Processo" section to render (DWR AJAX populates this)
  // Note: RESEARCH.md assumption A3 was INCORRECT — heading is "Eventos do Processo",
  // not "Etapas do Processo". Confirmed via live DOM inspection.
  await accessFrame.waitForSelector('text=Eventos do Processo', { timeout: 15000 });

  if (flags.verbose) console.log('[verbose] "Eventos do Processo" section found');

  // Extract rows from the Eventos do Processo table
  // Confirmed XPath: //table[.//text()[contains(., "Eventos do Processo")]]//tr
  const rows = await accessFrame.locator(
    'xpath=//table[.//text()[contains(., "Eventos do Processo")]]//tr'
  ).all();

  if (flags.verbose) console.log('[verbose] Raw rows found:', rows.length);

  // Parse data rows: exactly 7 cells AND cells[1]=description AND cells[2]=date (DD/MM/YY format)
  const movimentacoes = [];
  const datePattern = /^\d{2}\/\d{2}\/\d{2}$/;

  for (const row of rows) {
    const cells = await row.locator('td').all();
    if (cells.length !== 7) continue; // skip headers (5-6 cells) and separators (2 cells)

    const description = (await cells[1].innerText()).trim();
    const date = (await cells[2].innerText()).trim();

    // Skip rows where date doesn't match DD/MM/YY pattern
    if (!datePattern.test(date)) continue;
    // Skip rows where description is empty
    if (!description) continue;

    const movedBy = cells[3] ? (await cells[3].innerText()).trim() : '';

    movimentacoes.push({
      id: makeId(date, description),
      date,
      description,
      movedBy,
    });
  }

  // Assert we found at least one movimentação (REL-03 — detect silent empty scrape)
  if (movimentacoes.length === 0) {
    throw new Error(
      'No movimentacao rows found for ' + caseNumber +
      ' — possible page load failure or selector mismatch'
    );
  }

  if (flags.verbose) console.log('[verbose] Extracted', movimentacoes.length, 'movimentações');

  return movimentacoes;
}

// ---------------------------------------------------------------------------
// DIFF AND OUTPUT
// ---------------------------------------------------------------------------

async function processCase(page, proc, flags) {
  const caseNumber = proc.caseNumber;
  const label = proc.label || caseNumber;

  const fresh = await scrapeCase(page, caseNumber, flags);
  const stored = loadState(caseNumber);

  // Compute new entries (DIFF-01)
  const storedIds = new Set((stored.movimentacoes ?? []).map(m => m.id));
  const newMovs = fresh.filter(m => !storedIds.has(m.id));

  if (flags.verbose) console.log('[verbose]', newMovs.length, 'new movimentacao(s) found for', caseNumber);

  // Print new entries (DIFF-02, DIFF-03 — no output when nothing new)
  if (newMovs.length > 0) {
    console.log('\n=== ' + label + ' ===');
    for (const m of newMovs) {
      const por = m.movedBy ? '  (por: ' + m.movedBy + ')' : '';
      console.log('  [' + m.date + '] ' + m.description + por);
    }
  }

  // Save state unless --dry-run (CLI-01)
  if (!flags.dryRun) {
    saveState(caseNumber, {
      lastChecked: new Date().toISOString(),
      movimentacoes: fresh,
    });
    if (flags.verbose) console.log('[verbose] State saved to', path.join(STATE_DIR, caseNumber + '.json'));
  } else {
    if (flags.verbose) console.log('[verbose] --dry-run active: state NOT saved for', caseNumber);
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const flags = {
    dryRun: args.includes('--dry-run'),
    verbose: args.includes('--verbose'),
  };

  if (flags.verbose) console.log('[verbose] Flags:', flags);

  const processes = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));

  // Browser launch per D-01, SCRP-03
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    locale: 'pt-BR',
    timezoneId: 'America/Bahia',
  });

  const page = await context.newPage();

  // REL-01: per-case error isolation — one bad case does not abort the batch
  let hadFailure = false;

  // REL-02: try/finally guarantees browser.close() always runs, even when every case throws
  try {
    for (const proc of processes) {
      try {
        if (flags.verbose) console.log('[verbose] Processing case:', proc.caseNumber, proc.label ? ('(' + proc.label + ')') : '');
        await processCase(page, proc, flags);
      } catch (err) {
        console.error('[ERROR] ' + (proc.label ?? proc.caseNumber) + ': ' + err.message);
        hadFailure = true;
      }

      // Delay between cases — NOT after the last one (CFG-02, SCRP-02)
      if (proc !== processes[processes.length - 1]) {
        const delayMs = BASE_DELAY_MS + Math.floor(Math.random() * JITTER_MS);
        if (flags.verbose) console.log('[verbose] Waiting ' + delayMs + 'ms before next case...');
        await sleep(delayMs);
        if (flags.verbose) console.log('[verbose] Delay complete, continuing to next case');
      }
    }

    // Set exit code AFTER loop, BEFORE finally executes (DIFF-04)
    // Using process.exitCode (NOT process.exit()) so async browser.close() in finally can complete
    process.exitCode = hadFailure ? 1 : 0;
  } finally {
    await browser.close();
  }
}

// Entry point — uses process.exitCode instead of process.exit() so event loop drains naturally (RESEARCH.md Pattern 2)
main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exitCode = 1;
});
