// The weekly email: a little ghost delivering a useful website health report.
// Built with tables and inline styles so it renders in Gmail, Outlook and Apple Mail, light or dark.
// Images are plain PNGs served from the public repo, because email clients won't load anything else.

import { short } from './report.js';
import { isImportant, pathOf } from './digest.js';

export const ASSETS = 'https://raw.githubusercontent.com/raoashwini21/graveyard-shift/main/public/email/';

const C = { bg: '#0b1029', card: '#151b3f', card2: '#1b2250', line: '#2a3263', text: '#f6efe1', muted: '#b9b4c9', dim: '#8a87a3', amber: '#ffc46b', red: '#ff9c86', green: '#9fd0b4' };
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "'Bricolage Grotesque', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "'Spline Sans Mono', Menlo, Consolas, monospace";

const KIND = {
  dead: { spirit: 'The Departed', what: 'Dead link', icon: '🪦' },
  possessed: { spirit: 'The Possessed', what: 'Hijacked link', icon: '😈' },
  'past-event': { spirit: 'The Forgotten Feast', what: 'Expired event', icon: '🎈' },
  'stale-year': { spirit: 'The Stopped Clock', what: 'Old copyright year', icon: '⏳' },
  nameless: { spirit: 'The Nameless', what: 'Page without a title', icon: '❓' },
  chain: { spirit: 'The Wanderer', what: 'Redirect chain', icon: '🧭' },
  speechless: { spirit: 'The Silent', what: 'Page without a description', icon: '🤐' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const shortDay = (iso) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'earlier');
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function subject(d) {
  const host = hostOf(d.result.site);
  const n = d.added.length;
  if (d.firstRun) return n ? `Wisp found ${plural(n, 'ghost')} haunting ${host} 👻` : `${host} is at peace 🌙`;
  if (n) return n === 1 ? `A new ghost moved into ${host} 👻` : `${n} new ghosts moved into ${host} 👻`;
  if (d.resolved.length) return `${plural(d.resolved.length, 'ghost')} laid to rest on ${host} ✨`;
  return `All quiet at ${host} 🌙`;
}

// The page the problem lives on, and the plain-language problem and proof.
const page = (g) => {
  const p = (g.foundOn || [])[0];
  if (!p || p === 'sitemap.xml') return p === 'sitemap.xml' ? 'your sitemap' : '';
  const s = short(p);
  return s === '/' ? 'your home page' : s;
};
const subjectOf = (g, site) => (g.quote ? `“${g.quote}”` : short(g.url, site));
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
  // The link as it's written on the page: the full markup when the address itself is wrong, otherwise just its text.
  if (d.error === 'malformed' && d.evidence?.href) out.push(`written on the page as ${d.evidence.href}${d.evidence.text ? ` (“${d.evidence.text}”)` : ''}`);
  else if (d.evidence?.text) out.push(`link text “${d.evidence.text}”`);
  return out.join(' · ');
}

const review = (g) => (g.confidence === 'maybe'
  ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;border:1px solid ${C.amber};color:${C.amber};font:600 11px ${SANS};letter-spacing:.06em;text-transform:uppercase;vertical-align:2px">Needs review</span>`
  : '');
const btn = (href, label, primary = true) => `<a href="${esc(href)}" style="display:inline-block;padding:${primary ? '15px 28px' : '10px 18px'};border-radius:12px;background:${primary ? C.amber : C.card2};color:${primary ? '#2b1705' : C.text};font:700 ${primary ? 16 : 14}px ${SANS};text-decoration:none;${primary ? '' : `border:1px solid ${C.line};`}">${esc(label)}</a>`;

function ghostRow(g, site, assets) {
  const k = KIND[g.type] || { spirit: g.name, what: g.name };
  return `<tr><td style="padding:14px 0;border-top:1px solid ${C.line}">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td width="56" valign="top"><img src="${assets}spirit-${g.type}.png" width="48" height="48" alt="" style="display:block;border:0"></td>
      <td valign="top" style="font:400 14px/1.5 ${SANS};color:${C.muted}">
        <div style="font:700 15px/1.35 ${SANS};color:${C.text}">${esc(k.what)} ${review(g)}</div>
        <div style="font:500 13px/1.5 ${MONO};color:${C.text};word-break:break-all;margin-top:2px">${esc(subjectOf(g, site))}</div>
        <div style="margin-top:4px">On <b style="color:${C.text};font-weight:600">${esc(page(g))}</b>${g.foundOn?.length > 1 ? ` and ${g.foundOn.length - 1} more` : ''}${evidence(g) ? ` · ${esc(evidence(g))}` : ''}</div>
        <div style="margin-top:6px;color:${C.text}"><span style="color:${C.amber};font-weight:700">Fix:</span> ${esc(g.fix)}</div>
      </td></tr></table></td></tr>`;
}

export function html(d, { reportUrl, unsubscribeUrl, assets = ASSETS } = {}) {
  const r = d.result, site = r.site, host = hostOf(site);
  const n = d.added.length;
  const headline = d.firstRun
    ? (n ? `Wisp found <span style="color:${C.amber};font-style:italic">${n}</span> ghost${n === 1 ? '' : 's'} on ${esc(host)}` : `${esc(host)} is at peace`)
    : n ? `<span style="color:${C.amber};font-style:italic">${n}</span> new ghost${n === 1 ? '' : 's'} moved in` : d.resolved.length ? 'Some ghosts were laid to rest' : 'All quiet this week';
  const tile = (num, label, color) => `<td width="33%" align="center" style="padding:14px 6px;background:${C.card};border-radius:14px">
      <div style="font:600 30px/1 ${SERIF};color:${color}">${num}</div><div style="font:600 10.5px/1.3 ${SANS};letter-spacing:.06em;text-transform:uppercase;color:${C.dim};margin-top:6px">${label}</div></td>`;
  const ff = d.fixFirst;
  const fixFirst = ff ? `
    <tr><td style="padding:26px 24px 0">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.card2};border:1px solid ${C.amber};border-radius:18px"><tr><td style="padding:20px 20px 22px">
        <div style="font:700 12px ${SANS};letter-spacing:.12em;text-transform:uppercase;color:${C.amber}">🔦 Fix this first${isImportant(ff) ? ' · on a page that makes you money' : ''}</div>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px"><tr>
          <td width="84" valign="top"><img src="${assets}spirit-${ff.type}.png" width="76" height="76" alt="" style="display:block;border:0"></td>
          <td valign="top" style="font:400 14px/1.55 ${SANS};color:${C.muted}">
            <div style="font:600 21px/1.25 ${SERIF};color:${C.text}">${esc((KIND[ff.type] || {}).what || ff.name)} on ${esc(page(ff))} ${review(ff)}</div>
            <div style="font:500 13px/1.5 ${MONO};color:${C.text};word-break:break-all;margin-top:6px">${esc(subjectOf(ff, site))}</div>
            ${evidence(ff) ? `<div style="margin-top:4px">${esc(evidence(ff))}</div>` : ''}
            <div style="margin-top:8px;color:${C.text}"><span style="color:${C.amber};font-weight:700">Fix:</span> ${esc(ff.fix)}</div>
            ${(ff.foundOn || [])[0] && /^https?:/.test(ff.foundOn[0]) ? `<div style="margin-top:14px">${btn(ff.foundOn[0], 'Open the page', false)}</div>` : ''}
          </td></tr></table>
      </td></tr></table></td></tr>` : '';
  const LIST = 8;
  const arrivals = d.added.filter((g) => g !== ff).slice(0, LIST);
  const moreNew = d.added.length - (ff && d.added.includes(ff) ? 1 : 0) - arrivals.length;
  const section = (emoji, title, sub) => `<tr><td style="padding:30px 24px 4px">
      <div style="font:600 22px/1.2 ${SERIF};color:${C.text}">${emoji} ${title}</div>
      ${sub ? `<div style="font:400 14px/1.5 ${SANS};color:${C.muted};margin-top:4px">${sub}</div>` : ''}</td></tr>`;
  const stillOldest = d.still.reduce((m, g) => (!m || (g.firstSeen && g.firstSeen < m) ? g.firstSeen : m), null);
  const stillTop = [...d.still].sort((a, b) => (a.firstSeen || '').localeCompare(b.firstSeen || '')).slice(0, 3);

  const parts = [];
  parts.push(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${esc(subject(d))}</title>
<style>@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Bricolage+Grotesque:wght@400;600;700&display=swap');
@media (max-width:620px){ .wrap{width:100%!important} .pad{padding-left:18px!important;padding-right:18px!important} }</style></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(n ? `${plural(n, 'new ghost')} on ${host}. ${ff ? `Fix first: ${(KIND[ff.type] || {}).what} on ${page(ff)}.` : ''}` : `${host}: nothing new this week.`)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="wrap" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:${C.bg}">`);
  // Header: Wisp with his lantern
  parts.push(`<tr><td align="center" style="padding:6px 24px 0"><img src="${assets}wisp.png" width="150" height="150" alt="Wisp the night-watch ghost" style="display:block;border:0"></td></tr>
<tr><td align="center" class="pad" style="padding:6px 24px 0">
  <div style="font:700 11px ${SANS};letter-spacing:.16em;text-transform:uppercase;color:${C.amber}">Graveyard Shift · weekly watch</div>
  <div style="font:600 32px/1.15 ${SERIF};color:${C.text};margin-top:10px">${headline}</div>
  <div style="font:400 15px/1.55 ${SANS};color:${C.muted};margin-top:10px">Wisp walked <b style="color:${C.text}">${esc(host)}</b> on ${esc(day(r.scannedAt))}: ${plural(r.pagesScanned, 'page')} and ${plural(r.linksChecked, 'link')} checked.</div>
</td></tr>`);
  // Summary
  parts.push(`<tr><td class="pad" style="padding:22px 24px 0"><table role="presentation" class="tiles" width="100%" cellspacing="8" cellpadding="0"><tr>
    ${tile(d.added.length, 'New arrivals', d.added.length ? C.amber : C.text)}${tile(d.still.length, 'Still haunting', C.text)}${tile(d.resolved.length, 'Laid to rest', d.resolved.length ? C.green : C.text)}
  </tr></table></td></tr>`);
  parts.push(fixFirst);
  if (arrivals.length) {
    parts.push(section('👻', d.firstRun ? 'Everything Wisp found' : 'New arrivals', d.firstRun ? '' : 'Found this week for the first time.'));
    parts.push(`<tr><td class="pad" style="padding:0 24px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${arrivals.map((g) => ghostRow(g, site, assets)).join('')}</table>
      ${moreNew > 0 ? `<div style="font:500 14px ${SANS};color:${C.muted};padding:12px 0 0">…and ${plural(moreNew, 'more new ghost')} in the full investigation.</div>` : ''}</td></tr>`);
  }
  if (d.still.length && !d.firstRun) {
    parts.push(section('🕯️', 'Still haunting', `${plural(d.still.length, 'ghost')} from earlier weeks ${d.still.length === 1 ? 'is' : 'are'} still here${stillOldest ? `, the oldest since ${esc(shortDay(stillOldest))}` : ''}. Not repeated in full.`));
    parts.push(`<tr><td class="pad" style="padding:6px 24px 0;font:400 14px/1.7 ${SANS};color:${C.muted}">${stillTop.map((g) => `${KIND[g.type]?.icon || '👻'} <span style="color:${C.text}">${esc((KIND[g.type] || {}).what || g.name)}</span> on ${esc(page(g))} <span style="color:${C.dim}">· since ${esc(shortDay(g.firstSeen))}</span>`).join('<br>')}</td></tr>`);
  }
  if (d.resolved.length) {
    parts.push(`<tr><td class="pad" style="padding:30px 24px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${C.card};border-radius:18px"><tr>
      <td width="96" valign="middle" style="padding:16px 0 16px 16px"><img src="${assets}wisp-happy.png" width="84" height="84" alt="" style="display:block;border:0"></td>
      <td valign="middle" style="padding:16px 18px 16px 10px;font:400 14px/1.6 ${SANS};color:${C.muted}">
        <div style="font:600 21px/1.2 ${SERIF};color:${C.green}">✨ Laid to rest</div>
        <div style="margin:4px 0 6px">${plural(d.resolved.length, 'ghost')} gone since the last scan, re-checked and confirmed. Nice work.</div>
        ${d.resolved.slice(0, 5).map((g) => `<div style="color:${C.text}"><s style="color:${C.dim}">${esc(subjectOf(g, site))}</s> <span style="color:${C.dim}">· ${esc((KIND[g.type] || {}).what || g.name)}</span></div>`).join('')}
        ${d.resolved.length > 5 ? `<div>…and ${d.resolved.length - 5} more.</div>` : ''}
      </td></tr></table></td></tr>`);
  }
  // The one call to action
  parts.push(`<tr><td align="center" style="padding:34px 24px 6px">${btn(reportUrl || site, 'View the full investigation')}</td></tr>`);
  const locked = r.lockedCount || 0;
  parts.push(`<tr><td align="center" class="pad" style="padding:26px 24px 8px;font:400 12.5px/1.6 ${SANS};color:${C.dim}">
    ${locked ? `${plural(locked, 'link')} on sites that block bots couldn't be checked, so ${locked === 1 ? "it isn't" : "they aren't"} counted. ` : ''}Only problems Wisp could verify are reported; anything uncertain says Needs review. Nothing is marked fixed until a new scan confirms it.<br><br>
    You get this email only when something new moves in.
    ${unsubscribeUrl ? `<a href="${esc(unsubscribeUrl)}" style="color:${C.muted}">Turn off weekly checks</a> ·` : ''}
    <a href="https://github.com/raoashwini21/graveyard-shift" style="color:${C.muted}">Graveyard Shift</a>, free and open source
  </td></tr>`);
  parts.push('</table></td></tr></table></body></html>');
  return parts.join('\n');
}

export function text(d, { reportUrl, unsubscribeUrl } = {}) {
  const r = d.result, site = r.site, out = [subject(d), '', `Wisp walked ${hostOf(site)} on ${day(r.scannedAt)}: ${plural(r.pagesScanned, 'page')} and ${plural(r.linksChecked, 'link')} checked.`, ''];
  out.push(`New arrivals: ${d.added.length}   Still haunting: ${d.still.length}   Laid to rest: ${d.resolved.length}`, '');
  const line = (g) => `- ${(KIND[g.type] || {}).what || g.name}${g.confidence === 'maybe' ? ' (needs review)' : ''}: ${subjectOf(g, site)}\n  On ${page(g)}${evidence(g) ? ` · ${evidence(g)}` : ''}\n  Fix: ${g.fix}`;
  if (d.fixFirst) out.push('FIX THIS FIRST', line(d.fixFirst), '');
  const rest = d.added.filter((g) => g !== d.fixFirst);
  if (rest.length) out.push(d.firstRun ? 'EVERYTHING WISP FOUND' : 'NEW ARRIVALS', ...rest.slice(0, 15).map(line), '');
  if (d.resolved.length) out.push('LAID TO REST', ...d.resolved.slice(0, 10).map((g) => `- ${subjectOf(g, site)}`), '');
  out.push(`Full investigation: ${reportUrl || site}`);
  if (unsubscribeUrl) out.push(`Turn off weekly checks: ${unsubscribeUrl}`);
  return out.join('\n');
}

export { pathOf };
