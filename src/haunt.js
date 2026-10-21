// The weekly haunt. Keeps one open GitHub issue per site up to date.
// - First time ghosts appear: opens the issue (GitHub emails you).
// - New ghosts later: updates the issue and comments with only the new ones (emails you).
// - Nothing new: updates the issue quietly (no email).
// - No ghosts left: comments "at peace" and closes the issue.
// The previous scan is remembered inside the issue body, so nothing is committed to your repo.

import { deflateSync, inflateSync } from 'node:zlib';
import { toMarkdown, short } from './report.js';
import { digest, isImportant } from './digest.js';

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

// The weekly card. GitHub emails every comment, pictures included, so this is the email people get.
// Only GitHub's own formatting works here (tables, images, headings); pictures load from the public repo.
export const ASSETS = 'https://raw.githubusercontent.com/raoashwini21/graveyard-shift/main/public/email/';
const KIND = {
  dead: ['🪦', 'Dead link'], possessed: ['😈', 'Hijacked link'], 'past-event': ['🎈', 'Expired event'], 'stale-year': ['⏳', 'Old copyright year'],
  nameless: ['❓', 'Page without a title'], chain: ['🧭', 'Redirect chain'], speechless: ['🤐', 'Page without a description'],
};
const what = (g) => (KIND[g.type] || [])[1] || g.name;
const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pageOf = (g) => { const p = (g.foundOn || [])[0]; if (!p) return ''; if (p === 'sitemap.xml') return 'your sitemap'; const s = short(p); return s === '/' ? 'your home page' : s; };
const where = (g) => pageOf(g) + ((g.foundOn || []).length > 1 ? ` and ${g.foundOn.length - 1} more` : '');
const subjectOf = (g, site) => (g.quote ? `“${g.quote}”` : short(g.url, site));
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'earlier');
const n_ = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function evidence(g) {
  const d = g.detail || {}, out = [];
  if (g.type === 'dead') {
    if (d.error === 'malformed') out.push('the address itself is broken');
    else if (d.error === 'ENOTFOUND') out.push('the domain no longer exists');
    else if (d.status) out.push(`server answered ${d.status}${d.status === 404 ? ' Not Found' : d.status === 410 ? ' Gone' : ''}`);
    if (d.verified) out.push('double-checked as a browser');
  }
  if (g.type === 'possessed' && d.finalUrl) out.push(`now lands on ${hostOf(d.finalUrl)}`);
  if (g.type === 'chain') out.push(/loop/i.test(g.label || '') ? 'redirects in a loop' : `${(d.hops || []).length || 'several'} redirects before arriving`);
  if (d.error === 'malformed' && d.evidence?.href) out.push(`written on the page as ${d.evidence.href}${d.evidence.text ? ` (“${d.evidence.text}”)` : ''}`);
  else if (d.evidence?.text) out.push(`link text “${d.evidence.text}”`);
  return out.join(' · ');
}

export function cardTitle(d) {
  const host = hostOf(d.result.site), n = d.added.length;
  if (d.firstRun) return `👻 Wisp found ${n_(n, 'ghost')} haunting ${host}`;
  return n === 1 ? `👻 A new ghost moved into ${host}` : `👻 ${n} new ghosts moved into ${host}`;
}

const ghostCell = (g, site, size) => `<td width="${size + 16}" valign="top"><img src="${ASSETS}spirit-${g.type}.png" width="${size}" height="${size}" alt="${escHtml(what(g))}"></td>
<td valign="top"><b>${escHtml(what(g))}</b>${g.confidence === 'maybe' ? ' · <i>needs review</i>' : ''}<br>
<code>${escHtml(subjectOf(g, site))}</code><br>
On <b>${escHtml(where(g))}</b>${evidence(g) ? ` · ${escHtml(evidence(g))}` : ''}<br>
<b>Fix:</b> ${escHtml(g.fix)}</td>`;

export function digestMarkdown(d, mention, { reportUrl, turnOffUrl } = {}) {
  const r = d.result, site = r.site, host = hostOf(site);
  const L = [];
  L.push(`<p align="center"><img src="${ASSETS}wisp.png" width="120" height="120" alt="Wisp, the night-watch ghost"></p>`, '');
  L.push(`<h2 align="center">${escHtml(cardTitle(d))}</h2>`, '');
  L.push(`<p align="center">${mention ? `@${mention} · ` : ''}Wisp walked <b>${escHtml(host)}</b> on ${escHtml(day(r.scannedAt))}: ${n_(r.pagesScanned, 'page')} and ${n_(r.linksChecked, 'link')} checked.</p>`, '');
  L.push(`<table align="center"><tr>
<td align="center">👻<br><b>${d.added.length}</b><br><sub>NEW ARRIVALS</sub></td>
<td align="center">🕯️<br><b>${d.still.length}</b><br><sub>STILL HAUNTING</sub></td>
<td align="center">✨<br><b>${d.resolved.length}</b><br><sub>LAID TO REST</sub></td>
</tr></table>`, '');
  const ff = d.fixFirst;
  if (ff) L.push(`### 🔦 Fix this first${isImportant(ff) ? ' · on a page that makes you money' : ''}`, '', `<table><tr>${ghostCell(ff, site, 72)}</tr></table>`, '');
  const rest = d.added.filter((g) => g !== ff);
  if (rest.length) {
    L.push(`### 👻 ${d.firstRun ? 'Everything Wisp found' : 'New arrivals'}`, '');
    L.push(`<table>${rest.slice(0, 12).map((g) => `<tr>${ghostCell(g, site, 44)}</tr>`).join('\n')}</table>`, '');
    if (rest.length > 12) L.push(`…and ${n_(rest.length - 12, 'more new ghost')} in the full investigation.`, '');
  }
  if (d.still.length && !d.firstRun) {
    const oldest = [...d.still].sort((a, b) => (a.firstSeen || '').localeCompare(b.firstSeen || ''));
    L.push('### 🕯️ Still haunting', '', `${n_(d.still.length, 'ghost')} from earlier weeks ${d.still.length === 1 ? 'is' : 'are'} still here, the oldest since ${shortDay(oldest[0].firstSeen)}. Not repeated in full:`, '');
    for (const g of oldest.slice(0, 3)) L.push(`- ${(KIND[g.type] || ['👻'])[0]} ${what(g)} on ${where(g)} · since ${shortDay(g.firstSeen)}`);
    L.push('');
  }
  if (d.resolved.length) {
    L.push(`<table><tr><td width="96"><img src="${ASSETS}wisp-happy.png" width="80" height="80" alt=""></td><td>
<h3>✨ Laid to rest</h3>${n_(d.resolved.length, 'ghost')} gone since the last scan, re-checked and confirmed. Nice work.<br>
${d.resolved.slice(0, 6).map((g) => `<s>${escHtml(subjectOf(g, site))}</s> · ${escHtml(what(g))}`).join('<br>')}</td></tr></table>`, '');
  }
  if (reportUrl) L.push(`<p align="center"><a href="${reportUrl}"><b>🏮 View the full investigation →</b></a></p>`, '');
  L.push(`<sub>${r.lockedCount ? `${n_(r.lockedCount, 'link')} on sites that block bots couldn't be checked, so they aren't counted. ` : ''}Only problems Wisp could verify are reported; anything uncertain says needs review. Nothing is marked fixed until a new scan re-checks it. You hear from Wisp only when something new moves in.${turnOffUrl ? ` To stop the weekly checks, <a href="${turnOffUrl}">disable the workflow</a>.` : ''}</sub>`);
  return L.join('\n');
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
export async function haunt(result, gh, { mention = null, turnOffUrl = null } = {}) {
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
    const created = await gh.createIssue({ title: cardTitle(d), body: digestMarkdown(d, mention, { turnOffUrl }) + '\n\n---\n\n' + issueBody(result, d, null), labels: [LABEL] });
    return { action: 'opened', issue: created.number, issueUrl: created.html_url, added: d.added.length, digest: d };
  }

  if (result.ghostCount === 0) {
    await gh.updateIssue(issue.number, { title: `✨ ${hostOf(result.site)} is at peace`, body: issueBody(result, d, null) });
    await gh.comment(issue.number, `✨ ${mention ? `@${mention} ` : ''}**Your site is at peace.** Every ghost has been laid to rest, and this scan confirmed it. Closing this until something new moves in.`);
    await gh.updateIssue(issue.number, { state: 'closed' });
    return { action: 'closed', issue: issue.number, issueUrl: issue.html_url, banished: d.resolved.length, digest: d };
  }

  if (d.added.length) {
    // The issue title becomes the email subject: "👻 3 new ghosts moved into example.com".
    await gh.updateIssue(issue.number, { title: cardTitle(d), body: issueBody(result, d, null) });
    await gh.comment(issue.number, digestMarkdown(d, mention, { reportUrl: issue.html_url, turnOffUrl }));
    return { action: 'haunted', issue: issue.number, issueUrl: issue.html_url, added: d.added.length, banished: d.resolved.length, digest: d };
  }
  await gh.updateIssue(issue.number, { title: issueTitle(result), body: issueBody(result, d, null) });
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
