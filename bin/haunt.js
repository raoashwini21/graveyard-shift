#!/usr/bin/env node
// Runs inside the GitHub Action: scan the site, then update the haunting issue.
// Env: HAUNT_SITE, HAUNT_MAX_PAGES, HAUNT_INTERNAL_ONLY, GITHUB_TOKEN, GITHUB_REPOSITORY
// Set HAUNT_DRY_RUN=1 to scan and print without touching GitHub.

import { appendFileSync } from 'node:fs';
import { scan } from '../src/scan.js';
import { toMarkdown } from '../src/report.js';
import { haunt, githubClient } from '../src/haunt.js';

const env = process.env;
const site = env.HAUNT_SITE || process.argv[2];
if (!site) {
  console.error('👻 No site to haunt. Set the "site" input (or HAUNT_SITE).');
  process.exit(2);
}

const options = {
  maxPages: Number(env.HAUNT_MAX_PAGES) || 100,
  external: env.HAUNT_INTERNAL_ONLY !== 'true',
};

console.log(`🏮 Walking the halls of ${site}…`);
let result;
try {
  result = await scan(site, options, (e) => {
    if (e.type === 'phase') console.log(`   ${e.phase}…`);
  });
} catch (err) {
  console.error(`👻 ${err.message}`);
  process.exit(1);
}
console.log(`   ${result.pagesScanned} pages, ${result.linksChecked} links, ${result.ghostCount} ghosts.`);

if (env.GITHUB_STEP_SUMMARY) {
  appendFileSync(env.GITHUB_STEP_SUMMARY, toMarkdown(result, { title: `Graveyard Shift: ${result.site}` }) + '\n');
}

if (env.HAUNT_DRY_RUN === '1') {
  console.log(toMarkdown(result));
  process.exit(0);
}

if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
  console.error('👻 Missing GITHUB_TOKEN or GITHUB_REPOSITORY, so no issue was updated.');
  process.exit(1);
}

try {
  const gh = githubClient({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY, apiUrl: env.GITHUB_API_URL });
  const outcome = await haunt(result, gh);
  const msg = {
    opened: `👻 Opened issue #${outcome.issue} with ${outcome.added} ghosts.`,
    haunted: `👻 ${outcome.added} new ghosts. Commented on issue #${outcome.issue}.`,
    'updated quietly': `🕯️ No new ghosts. Issue #${outcome.issue} updated quietly.`,
    closed: `✨ At peace. Closed issue #${outcome.issue}.`,
    none: '✨ At peace. Nothing to report.',
  }[outcome.action];
  console.log(msg);
} catch (err) {
  console.error(`👻 Couldn't update the issue: ${err.message}`);
  if (err.status === 403) console.error('   Give the workflow "issues: write" permission.');
  process.exit(1);
}
