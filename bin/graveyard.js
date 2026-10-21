#!/usr/bin/env node
// Graveyard Shift CLI.
//   graveyard-shift <url> [--max-pages 50] [--internal-only] [--format text|md|json|csv]
//                         [--out file] [--state prev.json] [--fail-on-ghosts] [--ignore /path]

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { scan } from '../src/scan.js';
import { toText, toMarkdown, toCsv, diffScans } from '../src/report.js';

const HELP = `Graveyard Shift: find the ghosts on your website.

Usage: graveyard-shift <url> [options]

  --max-pages <n>     Pages to scan (default 50)
  --max-links <n>     Links to check (default 1000; your own links go first)
  --internal-only     Skip links to other sites
  --show-locked       List every link we couldn't verify, not just a summary
  --format <f>        text (default), md, json or csv
  --out <file>        Write the report to a file
  --state <file>      Compare with a previous JSON result: say what's new and what's gone
                      (with --fail-on-ghosts, fail only on new ghosts)
  --fail-on-ghosts    Exit with code 1 if any ghost is found (for CI)
  --ignore <text>     Skip URLs containing this text (repeatable)
  --config <file>     Read options from a JSON file (default: graveyard.config.json if present)
  -h, --help          Show this help
`;

function parseArgs(argv) {
  const a = { ignore: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => argv[++i];
    if (k === '-h' || k === '--help') a.help = true;
    else if (k === '--max-pages') a.maxPages = Number(next());
    else if (k === '--external') a.external = true;
    else if (k === '--internal-only') a.internalOnly = true;
    else if (k === '--max-links') a.maxLinks = Number(next());
    else if (k === '--show-locked') a.showLocked = true;
    else if (k === '--format') a.format = next();
    else if (k === '--out') a.out = next();
    else if (k === '--state') a.state = next();
    else if (k === '--fail-on-ghosts') a.failOnGhosts = true;
    else if (k === '--ignore') a.ignore.push(next());
    else if (k === '--config') a.config = next();
    else if (!k.startsWith('-') && !a.url) a.url = k;
    else { console.error(`Unknown option: ${k}`); process.exit(2); }
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.url) { console.log(HELP); process.exit(args.help ? 0 : 2); }

let config = {};
const configPath = args.config || (existsSync('graveyard.config.json') ? 'graveyard.config.json' : null);
if (configPath) config = JSON.parse(readFileSync(configPath, 'utf8'));

const options = {
  ...config,
  ...(args.maxPages ? { maxPages: args.maxPages } : {}),
  ...(args.maxLinks ? { maxLinks: args.maxLinks } : {}),
  ...(args.internalOnly ? { external: false } : {}),
  ignore: [...(config.ignore || []), ...args.ignore],
};

const isTty = process.stderr.isTTY;
let lastLine = '';
const progress = (e) => {
  if (!isTty) return;
  let msg = '';
  if (e.type === 'phase') msg = `🏮 ${e.phase}…`;
  else if (e.type === 'page') msg = `🏮 walking the halls · ${e.pagesScanned} pages`;
  else if (e.type === 'link') msg = `🏮 knocking on doors · ${e.linksChecked}/${e.linksTotal}`;
  if (msg && msg !== lastLine) { process.stderr.write(`\r\x1b[2K${msg}`); lastLine = msg; }
};

try {
  const result = await scan(args.url, options, progress);
  if (isTty) process.stderr.write('\r\x1b[2K');
  let prev = null;
  if (args.state && existsSync(args.state)) prev = JSON.parse(readFileSync(args.state, 'utf8'));
  const diff = prev ? diffScans(prev, result) : null;

  const format = args.format || 'text';
  let output;
  if (format === 'json') output = JSON.stringify({ ...result, diff: diff && { added: diff.added.map((g) => g.id), banished: diff.banished.map((g) => g.id) } }, null, 2);
  else if (format === 'md') output = toMarkdown(result, { diff });
  else if (format === 'csv') output = toCsv(result);
  else output = toText(result, { color: process.stdout.isTTY && !args.out, showLocked: args.showLocked });
  if (diff && format === 'text') output = `Since last scan: ${diff.added.length} new, ${diff.banished.length} gone.\n` + (diff.added.length ? diff.added.map((g) => `  new: ${g.name} · ${g.url || g.quote || ''}`).join('\n') + '\n' : '') + '\n' + output;

  if (args.out) writeFileSync(args.out, output + '\n');
  else console.log(output);

  // With --state, only ghosts that are new since last time fail the build.
  if (args.failOnGhosts && (diff ? diff.added.length : result.ghostCount) > 0) process.exit(1);
} catch (err) {
  if (isTty) process.stderr.write('\r\x1b[2K');
  console.error(`👻 ${err.message}`);
  process.exit(2);
}
