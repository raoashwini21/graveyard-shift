// Turn a scan result into something people read: terminal text, markdown
// (also used for the weekly GitHub issue), CSV, and a diff between two scans.

const ICON = { dead: '🪦', possessed: '👹', chain: '🌀', nameless: '👤', speechless: '🤐', 'stale-year': '🕰️', 'past-event': '🎃', locked: '🔒' };

// Show just the path for your own pages, the full address for anything else.
export const short = (url, site) => {
  if (!url) return '';
  if (url === 'sitemap.xml') return 'sitemap.xml';
  try {
    const u = new URL(url);
    const host = (h) => h.replace(/^www\./, '');
    if (site && host(u.hostname) !== host(new URL(site).hostname)) return url;
    return u.pathname + u.search;
  } catch { return url; }
};

// Which ghosts are new since last time, and which were banished.
export function diffScans(prev, cur) {
  const before = new Map((prev?.ghosts || []).map((g) => [g.id, g]));
  const now = new Set(cur.ghosts.map((g) => g.id));
  return {
    added: cur.ghosts.filter((g) => !before.has(g.id)),
    banished: [...before.values()].filter((g) => !now.has(g.id)),
  };
}

// Group ghosts by the page you'd open to fix them.
export function byPage(ghosts) {
  const pages = new Map();
  for (const g of ghosts) {
    const where = ['dead', 'chain', 'locked', 'possessed'].includes(g.type) ? g.foundOn : [g.url || g.foundOn[0]];
    for (const p of where) {
      if (!pages.has(p)) pages.set(p, []);
      pages.get(p).push(g);
    }
  }
  return [...pages.entries()].sort((a, b) => b[1].length - a[1].length);
}

function where(g) {
  const n = g.foundOn.length;
  const first = short(g.foundOn[0]);
  return n === 1 ? `on ${first}` : `on ${first} and ${n - 1} more page${n > 2 ? 's' : ''}`;
}

// Locked doors pile up fast on review sites like G2, so summarise them by site.
export function lockedByDomain(ghosts) {
  const counts = new Map();
  for (const g of ghosts) {
    if (g.type !== 'locked') continue;
    let host = g.url;
    try { host = new URL(g.url).hostname.replace(/^www\./, ''); } catch {}
    counts.set(host, (counts.get(host) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function limitNotes(result) {
  const l = result.limits || {};
  const notes = [];
  if (l.pagesCapped) notes.push(`Stopped at ${l.maxPages} pages. Raise --max-pages to scan more.`);
  if (l.linksCapped) notes.push(`Checked ${result.linksChecked} of ${l.linksTotal} links. Raise --max-links to check the rest.`);
  return notes;
}

export function toText(result, { color = false, showLocked = false } = {}) {
  const c = (code, s) => (color ? `\x1b[${code}m${s}\x1b[0m` : s);
  const lines = [];
  lines.push('');
  if (!result.ghostCount) {
    lines.push(c('32;1', `  Your site is at peace. ${result.pagesScanned} pages, ${result.linksChecked} links, no ghosts.`));
  } else {
    lines.push(c('35;1', `  ${result.ghostCount} GHOST${result.ghostCount === 1 ? '' : 'S'} FOUND`) +
      c('2', `  on ${result.site} · haunting score ${result.score} (${result.rank})`));
  }
  lines.push(c('2', `  Scanned ${result.pagesScanned} pages and ${result.linksChecked} links.`));
  lines.push('');
  for (const g of result.ghosts) {
    if (g.type === 'locked' && !showLocked) continue;
    const tag = g.confidence === 'maybe' ? c('33', ' (maybe)') : g.confidence === 'unverified' ? c('2', ' (unverified)') : '';
    lines.push(`  ${ICON[g.type] || '👻'} ${c('1', g.name)}${tag}  ${c('3', g.label)}`);
    if (g.url && g.type !== 'stale-year' && g.type !== 'past-event') lines.push(`     ${g.url}`);
    if (g.quote) lines.push(c('2', `     "${g.quote}"`));
    lines.push(c('2', `     ${where(g)}`));
    lines.push(`     ${c('36', 'Fix:')} ${g.fix}`);
    lines.push('');
  }
  const locked = lockedByDomain(result.ghosts);
  if (locked.length && !showLocked) {
    const total = locked.reduce((n, [, k]) => n + k, 0);
    const top = locked.slice(0, 5).map(([h, k]) => `${h} (${k})`).join(', ');
    lines.push(`  🔒 ${c('1', `${total} locked door${total === 1 ? '' : 's'}`)} ${c('2', "· sites that block bots, so we couldn't check them")}`);
    lines.push(c('2', `     ${top}${locked.length > 5 ? `, and ${locked.length - 5} more sites` : ''}. Use --show-locked to list them.`));
    lines.push('');
  }
  for (const n of limitNotes(result)) lines.push(c('2', `  ${n}`));
  return lines.join('\n');
}

export function toMarkdown(result, { diff = null, title = null } = {}) {
  const out = [];
  if (title) out.push(`# ${title}`, '');
  if (!result.ghostCount) {
    out.push(`**Your site is at peace.** ${result.pagesScanned} pages and ${result.linksChecked} links checked, no ghosts.`);
  } else {
    out.push(`**${result.ghostCount} ghost${result.ghostCount === 1 ? '' : 's'}** on ${result.site} · haunting score **${result.score}** (${result.rank}) · ${result.pagesScanned} pages, ${result.linksChecked} links checked`);
  }
  out.push('');
  if (diff) {
    if (diff.added.length) out.push(`👻 **${diff.added.length} new this time.**`);
    if (diff.banished.length) out.push(`✨ **${diff.banished.length} banished** since last scan.`);
    if (diff.added.length || diff.banished.length) out.push('');
  }
  const newIds = new Set((diff?.added || []).map((g) => g.id));
  const rows = (list) => {
    out.push('| | Ghost | Where | Fix |', '| --- | --- | --- | --- |');
    for (const g of list) {
      const subject = g.quote ? `“${g.quote.replace(/\|/g, '\\|')}”` : `\`${short(g.url, result.site)}\``;
      const tag = g.confidence === 'maybe' ? ' *(maybe)*' : g.confidence === 'unverified' ? ' *(unverified)*' : '';
      const fresh = newIds.has(g.id) ? ' 🆕' : '';
      out.push(`| ${ICON[g.type] || '👻'} | **${g.name}**${tag}${fresh}<br>${g.label}<br>${subject} | ${where(g).replace(/^on /, '')} | ${g.fix.replace(/\|/g, '\\|')} |`);
    }
    out.push('');
  };
  const real = result.ghosts.filter((g) => g.type !== 'locked');
  const locked = result.ghosts.filter((g) => g.type === 'locked');
  if (real.length) rows(real);
  if (locked.length) {
    const top = lockedByDomain(locked).slice(0, 5).map(([h, k]) => `${h} (${k})`).join(', ');
    out.push(`<details><summary>🔒 ${locked.length} locked door${locked.length === 1 ? '' : 's'}: sites that block bots, so they couldn't be checked. Mostly ${top}.</summary>`, '');
    rows(locked);
    out.push('</details>', '');
  }
  for (const n of limitNotes(result)) out.push(`> ${n}`, '');
  if (diff?.banished.length) {
    out.push('<details><summary>✨ Banished since last scan</summary>', '');
    for (const g of diff.banished) out.push(`- ~~${g.name}: ${g.quote || short(g.url, result.site)}~~`);
    out.push('', '</details>', '');
  }
  out.push(`<sub>Scanned ${result.scannedAt.slice(0, 16).replace('T', ' ')} UTC by Graveyard Shift.</sub>`);
  return out.join('\n');
}

export function toCsv(result) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['type', 'confidence', 'url', 'quote', 'label', 'fix', 'found_on'];
  const rows = result.ghosts.map((g) => [g.type, g.confidence, g.url, g.quote, g.label, g.fix, g.foundOn.join(' ')].map(esc).join(','));
  return [head.join(','), ...rows].join('\n') + '\n';
}
