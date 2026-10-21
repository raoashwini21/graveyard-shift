// The weekly haunt. Keeps one open GitHub issue per site up to date.
// - First time ghosts appear: opens the issue (GitHub emails you).
// - New ghosts later: updates the issue and comments with only the new ones (emails you).
// - Nothing new: updates the issue quietly (no email).
// - No ghosts left: comments "at peace" and closes the issue.
// The previous scan is remembered inside the issue body, so nothing is committed to your repo.

import { deflateSync, inflateSync } from 'node:zlib';
import { toMarkdown, short } from './report.js';
import { digest } from './digest.js';

export const LABEL = 'graveyard-shift';

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

// The memory between weeks: compressed, and capped so it always fits in an issue body.
export function encodeState(state) {
  const slim = {
    site: state.site, scannedAt: state.scannedAt,
    ghosts: (state.ghosts || []).slice(0, 400).map((g) => ({
      id: g.id, type: g.type, name: g.name, url: g.url ? String(g.url).slice(0, 240) : null, quote: g.quote ? String(g.quote).slice(0, 140) : null,
      foundOn: (g.foundOn || []).slice(0, 3).map((p) => String(p).slice(0, 200)), firstSeen: g.firstSeen || null,
    })),
  };
  return 'z' + deflateSync(Buffer.from(JSON.stringify(slim))).toString('base64');
}

export function decodeState(body = '') {
  const m = body.match(/<!-- graveyard-shift-state:(z?[A-Za-z0-9+/=]+) -->/);
  if (!m) return null;
  try {
    const raw = m[1].startsWith('z') ? inflateSync(Buffer.from(m[1].slice(1), 'base64')) : Buffer.from(m[1], 'base64');
    return JSON.parse(raw.toString('utf8'));
  } catch { return null; }
}

export function issueTitle(result) {
  const n = result.ghostCount;
  return `👻 ${n} ghost${n === 1 ? '' : 's'} haunt${n === 1 ? 's' : ''} ${hostOf(result.site)}`;
}

const KIND_ICON = { dead: '🪦', possessed: '😈', 'past-event': '🎈', 'stale-year': '⏳', nameless: '❓', chain: '🧭', speechless: '🤐' };
const where = (g) => { const p = (g.foundOn || [])[0]; if (!p) return ''; const s = p === 'sitemap.xml' ? 'your sitemap' : short(p); return (s === '/' ? 'the home page' : s) + (g.foundOn.length > 1 ? ` and ${g.foundOn.length - 1} more` : ''); };
const subjectMd = (g, site) => (g.quote ? `“${g.quote}”` : `\`${short(g.url, site)}\``);
const ghostMd = (g, site) => {
  const d = g.detail || {};
  const proof = [d.status && g.type === 'dead' ? `status ${d.status}` : '', d.evidence?.href ? `link on page: \`${d.evidence.href}\`` : ''].filter(Boolean).join(' · ');
  return [`- ${KIND_ICON[g.type] || '👻'} **${g.name}**${g.confidence === 'maybe' ? ' *(needs review)*' : ''}: ${subjectMd(g, site)}  `, `  On ${where(g)}${proof ? ` · ${proof}` : ''}  `, `  **Fix:** ${g.fix}`].join('\n');
};

export function digestMarkdown(d, mention) {
  const site = d.result.site, host = hostOf(site), n = d.added.length;
  const lines = [];
  lines.push(`👻 ${mention ? `@${mention} ` : ''}**${d.firstRun ? `Wisp found ${n} ghost${n === 1 ? '' : 's'} on ${host}.` : `${n} new ghost${n === 1 ? '' : 's'} moved into ${host} this week.`}**`, '');
  lines.push(`| 👻 New arrivals | 🕯️ Still haunting | ✨ Laid to rest |`, '| :-: | :-: | :-: |', `| **${n}** | **${d.still.length}** | **${d.resolved.length}** |`, '');
  if (d.fixFirst) lines.push('### 🔦 Fix this first', ghostMd(d.fixFirst, site), '');
  const rest = d.added.filter((g) => g !== d.fixFirst);
  if (rest.length) {
    lines.push(`### 👻 ${d.firstRun ? 'Everything Wisp found' : 'New arrivals'}`);
    for (const g of rest.slice(0, 25)) lines.push(ghostMd(g, site));
    if (rest.length > 25) lines.push(`- …and ${rest.length - 25} more in the issue above.`);
    lines.push('');
  }
  if (d.resolved.length) lines.push(`### ✨ Laid to rest`, `${d.resolved.length} ghost${d.resolved.length === 1 ? '' : 's'} gone since last scan (re-checked and confirmed). Nice work.`, ...d.resolved.slice(0, 10).map((g) => `- ~~${subjectMd(g, site)}~~`), '');
  return lines.join('\n');
}

export function issueBody(result, d, mention) {
  return [
    ...(mention ? [`👋 @${mention}, here's what's haunting your site.`, ''] : []),
    toMarkdown(result, { diff: d ? { added: d.added, banished: d.resolved } : null }),
    '',
    '---',
    '<sub>Kept up to date by the weekly Graveyard Shift scan. You get a comment (and an email) only when new ghosts move in. ' +
      'A ghost is only marked laid to rest after a new scan re-checks its page. To stop the weekly checks, disable or delete the workflow.</sub>',
    '',
    `<!-- graveyard-shift-state:${encodeState(d ? d.state : digest(null, result).state)} -->`,
  ].join('\n');
}

// gh: { findOpenIssue(label), createIssue({title, body, labels}), updateIssue(n, {title, body, state}),
//       comment(n, body), ensureLabel(name) }
export async function haunt(result, gh, { mention = null } = {}) {
  await gh.ensureLabel(LABEL);
  let issue = await gh.findOpenIssue(LABEL);

  // Switched to a different site? Close the old site's issue and start fresh.
  let prevState = issue ? decodeState(issue.body) : null;
  if (issue && prevState && prevState.site !== result.site) {
    await gh.updateIssue(issue.number, { state: 'closed' });
    issue = null; prevState = null;
  }
  const d = digest(prevState, result);

  if (!issue) {
    if (result.ghostCount === 0) return { action: 'none', reason: 'at peace, no issue to update', digest: d };
    const created = await gh.createIssue({ title: issueTitle(result), body: issueBody(result, d, mention), labels: [LABEL] });
    return { action: 'opened', issue: created.number, issueUrl: created.html_url, added: d.added.length, digest: d };
  }

  if (result.ghostCount === 0) {
    await gh.updateIssue(issue.number, { title: `✨ ${hostOf(result.site)} is at peace`, body: issueBody(result, d, null) });
    await gh.comment(issue.number, `✨ ${mention ? `@${mention} ` : ''}**Your site is at peace.** Every ghost has been laid to rest, and this scan confirmed it. Closing this until something new moves in.`);
    await gh.updateIssue(issue.number, { state: 'closed' });
    return { action: 'closed', issue: issue.number, issueUrl: issue.html_url, banished: d.resolved.length, digest: d };
  }

  await gh.updateIssue(issue.number, { title: issueTitle(result), body: issueBody(result, d, mention) });
  if (d.added.length) {
    await gh.comment(issue.number, digestMarkdown(d, mention));
    return { action: 'haunted', issue: issue.number, issueUrl: issue.html_url, added: d.added.length, banished: d.resolved.length, digest: d };
  }
  return { action: 'updated quietly', issue: issue.number, issueUrl: issue.html_url, added: 0, banished: d.resolved.length, digest: d };
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
