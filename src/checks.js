// Page-level checks: title, meta description, stale copyright years and
// invites to events that already happened. Also pulls out the page's links.

import { parse } from 'node-html-parser';

const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

const DATE_PATTERNS = [
  // March 5, 2025 / Mar 5th 2025 / March 5-6, 2025
  { re: new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?,?\\s+((?:19|20)\\d{2})\\b`, 'gi'), m: 1, d: 2, y: 3 },
  // 5 March 2025 / 5th of March, 2025
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\.?,?\\s+((?:19|20)\\d{2})\\b`, 'gi'), m: 2, d: 1, y: 3 },
  // 2025-03-05
  { re: /\b((?:19|20)\d{2})-(\d{2})-(\d{2})\b/g, iso: true },
];

// Words that invite you to something in the future.
const INVITE = /\b(register(?:\s+now)?|registration (?:is )?open|rsvp|save (?:your|my|a) (?:seat|spot)|reserve (?:your|a) (?:seat|spot)|book (?:your|a) (?:seat|spot|ticket)|get (?:your )?tickets|tickets (?:are )?(?:on sale|available)|join us(?: live)?|upcoming|sign up now|coming up)\b/i;
// Words that say the event is already acknowledged as over.
const ALREADY_PAST = /\b(recording|replay|watch (?:now|again|the recording|on[- ]demand)|on[- ]demand|past event|event (?:has )?ended|this event has ended|thanks? (?:you )?for (?:joining|attending)|recap|highlights)\b/i;
// Lines that are post metadata, not invitations.
const META_LINE = /\b(published|posted|updated|last (?:modified|updated)|written)\b/i;

const COPYRIGHT = /(?:©|\(c\)|copyright)\s*(?:©\s*)?((?:19|20)\d{2})(?:\s*(?:[-–—]|to)\s*((?:19|20)\d{2}))?/gi;

const SKIP_HREF = /^(#|mailto:|tel:|sms:|javascript:|data:|about:)/i;

function findDates(line) {
  const out = [];
  for (const p of DATE_PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(line))) {
      let y, mo, d;
      if (p.iso) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; }
      else { y = +m[p.y]; mo = MONTH_INDEX[m[p.m].slice(0, 3).toLowerCase()]; d = +m[p.d]; }
      if (mo < 0 || mo > 11 || d < 1 || d > 31) continue;
      out.push(new Date(Date.UTC(y, mo, d)));
    }
  }
  return out;
}

function clip(s, n = 180) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

export function analyzePage(html, pageUrl, { now = new Date(), quietPaths = [] } = {}) {
  const root = parse(html, { comment: false });
  root.querySelectorAll('script,style,noscript,template,svg').forEach((n) => n.remove());

  const metas = root.querySelectorAll('meta');
  const metaContent = (name) => {
    const el = metas.find((m) => (m.getAttribute('name') || '').toLowerCase() === name);
    return el ? (el.getAttribute('content') || '').trim() : null;
  };

  const title = (root.querySelector('head title') || root.querySelector('title'))?.text.trim() || '';
  const description = metaContent('description');
  const robots = (metaContent('robots') || '').toLowerCase();
  const noindex = robots.includes('noindex');

  // Links
  const baseHref = root.querySelector('base[href]')?.getAttribute('href');
  let base = pageUrl;
  try { if (baseHref) base = new URL(baseHref, pageUrl).href; } catch {}
  const links = new Set();
  for (const a of root.querySelectorAll('a[href]')) {
    const href = (a.getAttribute('href') || '').trim();
    if (!href || SKIP_HREF.test(href)) continue;
    try {
      const u = new URL(href, base);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') continue;
      u.hash = '';
      links.add(u.href);
    } catch {}
  }

  const findings = [];
  if (!noindex) {
    if (!title) findings.push({ type: 'nameless', key: pageUrl });
    if (!description) findings.push({ type: 'speechless', key: pageUrl });
  }

  const body = root.querySelector('body') || root;
  const lines = body.structuredText.split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const footerText = root
    .querySelectorAll('footer,[class*="footer"],[id*="footer"]')
    .map((n) => n.text.replace(/\s+/g, ' '))
    .join(' ');

  const path = new URL(pageUrl).pathname.toLowerCase();
  const quiet = quietPaths.some((p) => path.startsWith(p.toLowerCase()));
  const year = now.getUTCFullYear();

  // Stale copyright years
  for (const line of lines) {
    COPYRIGHT.lastIndex = 0;
    let m;
    while ((m = COPYRIGHT.exec(line))) {
      const y = +(m[2] || m[1]);
      if (y >= year) continue;
      const inFooter = footerText.includes(line.slice(0, 60));
      if (!inFooter && quiet) continue;
      findings.push({
        type: 'stale-year',
        confidence: inFooter ? 'confirmed' : 'maybe',
        key: `stale-year|${line}`,
        quote: clip(line),
        data: { year: y },
      });
    }
  }

  // Invites to events that already happened. Blog/news pages are meant to be old, so skip them.
  if (!quiet) {
    const cutoff = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86400000;
    const reported = new Set();
    lines.forEach((line, i) => {
      if (META_LINE.test(line)) return;
      const dates = findDates(line);
      if (!dates.length) return;
      const latest = new Date(Math.max(...dates.map((d) => +d)));
      if (+latest >= cutoff) return;
      const window = lines.slice(Math.max(0, i - 2), i + 3).join(' \n ');
      if (!INVITE.test(window) || ALREADY_PAST.test(window)) return;
      const from = Math.max(0, i - 2);
      const near = lines.slice(from, i + 3);
      const j = near.findIndex((l) => INVITE.test(l));
      const invite = near[j];
      let quote = line;
      if (invite && invite !== line) quote = from + j < i ? `${invite} … ${line}` : `${line} … ${invite}`;
      if (reported.has(line)) return;
      reported.add(line);
      findings.push({
        type: 'past-event',
        key: `past-event|${pageUrl}|${line}`,
        quote: clip(quote, 220),
        data: { date: latest },
      });
    });
  }

  return { title, description, noindex, links: [...links], findings };
}
