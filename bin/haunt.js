#!/usr/bin/env node
// Runs inside the GitHub Action: scan the site, then update the haunting issue.
// Env: HAUNT_SITE, HAUNT_MAX_PAGES, HAUNT_INTERNAL_ONLY, GITHUB_TOKEN, GITHUB_REPOSITORY
// Set HAUNT_DRY_RUN=1 to scan and print without touching GitHub.

import { appendFileSync } from 'node:fs';
import { scan } from '../src/scan.js';
import { toMarkdown } from '../src/report.js';
import { haunt, githubClient } from '../src/haunt.js';
import { digest, worthSending } from '../src/digest.js';
import { subject, html, text } from '../src/email.js';
import { writeFileSync } from 'node:fs';

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
  if (env.HAUNT_EMAIL_PREVIEW) {
    const d = digest(null, result);
    writeFileSync(env.HAUNT_EMAIL_PREVIEW, html(d, { reportUrl: result.site }));
    console.log(`✉️  Email preview written to ${env.HAUNT_EMAIL_PREVIEW} (subject: ${subject(d)})`);
  }
  process.exit(0);
}

const emailOn = Boolean(env.HAUNT_EMAIL_TO && env.HAUNT_SMTP_USER && env.HAUNT_SMTP_PASSWORD);

if (!env.GITHUB_TOKEN || !env.GITHUB_REPOSITORY) {
  console.error('👻 Missing GITHUB_TOKEN or GITHUB_REPOSITORY, so no issue was updated.');
  process.exit(1);
}

try {
  const gh = githubClient({ token: env.GITHUB_TOKEN, repo: env.GITHUB_REPOSITORY, apiUrl: env.GITHUB_API_URL });
  // @mention someone so GitHub actually emails them. Defaults to the repo owner.
  const raw = (env.HAUNT_MENTION || env.GITHUB_REPOSITORY_OWNER || '').replace(/^@/, '').trim();
  // With the designed email turned on, skip the @mention by default so you don't get two emails.
  const mention = raw && raw !== 'none' && !(emailOn && !env.HAUNT_MENTION) ? raw : null;
  const outcome = await haunt(result, gh, { mention });
  const msg = {
    opened: `👻 Opened issue #${outcome.issue} with ${outcome.added} ghosts.`,
    haunted: `👻 ${outcome.added} new ghosts. Commented on issue #${outcome.issue}.`,
    'updated quietly': `🕯️ No new ghosts. Issue #${outcome.issue} updated quietly.`,
    closed: `✨ At peace. Closed issue #${outcome.issue}.`,
    none: '✨ At peace. Nothing to report.',
  }[outcome.action];
  console.log(msg);
  if (emailOn) await sendEmail(outcome);
} catch (err) {
  console.error(`👻 Couldn't update the issue: ${err.message}`);
  if (err.status === 403) console.error('   Give the workflow "issues: write" permission.');
  process.exit(1);
}

// The designed weekly email. Sent only when something new moved in (or as HAUNT_EMAIL_WHEN says).
async function sendEmail(outcome) {
  const d = outcome.digest;
  const when = env.HAUNT_EMAIL_WHEN || 'new';
  if (!d || !worthSending(d, when)) { console.log('✉️  Nothing new, so no email this week.'); return; }
  const server = env.GITHUB_SERVER_URL || 'https://github.com';
  const repo = env.GITHUB_REPOSITORY;
  const wf = (env.GITHUB_WORKFLOW_REF || '').match(/\.github\/workflows\/([^@]+)@/);
  const unsubscribeUrl = `${server}/${repo}/actions${wf ? `/workflows/${wf[1]}` : ''}`;
  const reportUrl = outcome.issueUrl || `${server}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`;
  const { default: nodemailer } = await import('nodemailer');
  const port = Number(env.HAUNT_SMTP_PORT) || 465;
  const t = nodemailer.createTransport({
    host: env.HAUNT_SMTP_HOST || 'smtp.gmail.com', port, secure: port === 465,
    auth: { user: env.HAUNT_SMTP_USER, pass: env.HAUNT_SMTP_PASSWORD },
  });
  try {
    await t.sendMail({
      from: `"Wisp at Graveyard Shift" <${env.HAUNT_EMAIL_FROM || env.HAUNT_SMTP_USER}>`,
      to: env.HAUNT_EMAIL_TO,
      subject: subject(d),
      html: html(d, { reportUrl, unsubscribeUrl }),
      text: text(d, { reportUrl, unsubscribeUrl }),
      headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>` },
    });
    console.log(`✉️  Emailed ${env.HAUNT_EMAIL_TO}: ${subject(d)}`);
  } catch (err) {
    console.error(`✉️  The email couldn't be sent: ${err.message}`);
    if (/Invalid login|535|534/.test(err.message)) console.error('   For Gmail, use an app password (myaccount.google.com/apppasswords), not your normal password.');
  }
}
