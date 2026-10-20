// The weekly haunt. Keeps one open GitHub issue per site up to date.
// - First time ghosts appear: opens the issue (GitHub emails you).
// - New ghosts later: updates the issue and comments with only the new ones (emails you).
// - Nothing new: updates the issue quietly (no email).
// - No ghosts left: comments "at peace" and closes the issue.
// The previous scan is remembered inside the issue body, so nothing is committed to your repo.

import { toMarkdown, diffScans } from './report.js';

export const LABEL = 'graveyard-shift';
const STATE_RE = /<!-- graveyard-shift-state:([A-Za-z0-9+/=]+) -->/;

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };
const short = (url) => { try { const u = new URL(url); return u.pathname + u.search; } catch { return url; } };

export function encodeState(result) {
  const ghosts = result.ghosts
    .filter((g) => g.type !== 'locked')
    .map((g) => ({ id: g.id, name: g.name, quote: g.quote, url: g.url }));
  return Buffer.from(JSON.stringify({ site: result.site, ghosts })).toString('base64');
}

export function decodeState(body = '') {
  const m = body.match(STATE_RE);
  if (!m) return null;
  try { return JSON.parse(Buffer.from(m[1], 'base64').toString('utf8')); } catch { return null; }
}

export function issueTitle(result) {
  const n = result.ghostCount;
  return `👻 ${n} ghost${n === 1 ? '' : 's'} haunt${n === 1 ? 's' : ''} ${hostOf(result.site)}`;
}

export function issueBody(result, diff) {
  return [
    toMarkdown(result, { diff }),
    '',
    '---',
    '<sub>This issue is kept up to date by the weekly Graveyard Shift scan. You get a comment only when new ghosts move in. ' +
      'Fix a ghost and it disappears on the next scan. To stop the haunting, delete the workflow file.</sub>',
    '',
    `<!-- graveyard-shift-state:${encodeState(result)} -->`,
  ].join('\n');
}

export function newGhostsComment(result, added, banished) {
  const host = hostOf(result.site);
  const lines = [
    `👻 **${added.length} new ghost${added.length === 1 ? '' : 's'} moved into ${host} this week.**`,
    '',
  ];
  for (const g of added) {
    const subject = g.quote ? `“${g.quote}”` : `\`${short(g.url)}\``;
    lines.push(`- **${g.name}**: ${g.label}  `);
    lines.push(`  ${subject} on ${short(g.foundOn[0])}${g.foundOn.length > 1 ? ` and ${g.foundOn.length - 1} more` : ''}  `);
    lines.push(`  Fix: ${g.fix}`);
  }
  if (banished.length) lines.push('', `✨ ${banished.length} ghost${banished.length === 1 ? ' was' : 's were'} banished since last time. Nice work.`);
  return lines.join('\n');
}

// gh: { findOpenIssue(label), createIssue({title, body, labels}), updateIssue(n, {title, body, state}),
//       comment(n, body), ensureLabel(name) }
export async function haunt(result, gh) {
  await gh.ensureLabel(LABEL);
  const issue = await gh.findOpenIssue(LABEL);

  if (!issue) {
    if (result.ghostCount === 0) return { action: 'none', reason: 'at peace, no issue to update' };
    const created = await gh.createIssue({ title: issueTitle(result), body: issueBody(result, null), labels: [LABEL] });
    return { action: 'opened', issue: created.number, added: result.ghostCount };
  }

  const prev = decodeState(issue.body);
  const { added, banished } = diffScans(prev, { ghosts: result.ghosts.filter((g) => g.type !== 'locked') });

  if (result.ghostCount === 0) {
    await gh.updateIssue(issue.number, { title: `✨ ${hostOf(result.site)} is at peace`, body: issueBody(result, { added: [], banished }) });
    await gh.comment(issue.number, `✨ **Your site is at peace.** Every ghost has been banished. Closing this until something new moves in.`);
    await gh.updateIssue(issue.number, { state: 'closed' });
    return { action: 'closed', issue: issue.number, banished: banished.length };
  }

  await gh.updateIssue(issue.number, { title: issueTitle(result), body: issueBody(result, { added, banished }) });
  if (added.length) {
    await gh.comment(issue.number, newGhostsComment(result, added, banished));
    return { action: 'haunted', issue: issue.number, added: added.length, banished: banished.length };
  }
  return { action: 'updated quietly', issue: issue.number, added: 0, banished: banished.length };
}

// Minimal GitHub REST client using the workflow's token.
export function githubClient({ token, repo, apiUrl = 'https://api.github.com' }) {
  const call = async (method, path, body) => {
    const res = await fetch(`${apiUrl}/repos/${repo}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'content-type': 'application/json',
        'user-agent': 'graveyard-shift',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const err = new Error(`GitHub ${method} ${path} failed: ${res.status} ${data?.message || ''}`);
      err.status = res.status;
      throw err;
    }
    return data;
  };
  return {
    async ensureLabel(name) {
      try {
        await call('POST', '/labels', { name, color: '6e40c9', description: 'Ghosts found by the weekly Graveyard Shift scan' });
      } catch (e) {
        if (e.status !== 422) throw e; // 422 = already exists
      }
    },
    async findOpenIssue(label) {
      const list = await call('GET', `/issues?labels=${encodeURIComponent(label)}&state=open&per_page=10`);
      return list.find((i) => !i.pull_request) || null;
    },
    createIssue: (data) => call('POST', '/issues', data),
    updateIssue: (n, data) => call('PATCH', `/issues/${n}`, data),
    comment: (n, body) => call('POST', `/issues/${n}/comments`, { body }),
  };
}
