// The scan: find pages (sitemap first, then by following internal links),
// run the page checks, check every link, and turn it all into ghosts.

import { createHash } from 'node:crypto';
import { createFetcher } from './fetcher.js';
import { parseRobots } from './robots.js';
import { analyzePage } from './checks.js';
import { GHOST_TYPES, describe, scoreGhosts, sortGhosts } from './ghosts.js';

export const DEFAULTS = {
  maxPages: 50,
  maxLinks: 1000,
  // Links to other sites are where most dead links hide, so they're on by default.
  external: true,
  // Sites that hide pages from bots. A 404 from these is "locked", never "dead".
  botShy: ['linkedin.com', 'x.com', 'twitter.com', 'facebook.com', 'instagram.com', 'threads.net', 'tiktok.com', 'medium.com', 'quora.com'],
  concurrency: 4,
  delayMs: 150,
  timeoutMs: 10000,
  allowPrivate: true,
  respectRobots: true,
  quietPaths: ['/blog/', '/news/', '/archive/', '/press/', '/changelog'],
  ignore: [],
};

const NON_PAGE = /\.(pdf|jpe?g|png|gif|webp|svg|ico|zip|gz|mp4|mp3|mov|webm|css|js|json|xml|txt|csv|docx?|xlsx?|pptx?)(\?|$)/i;

const stripWww = (h) => h.replace(/^www\./, '');
const ghostId = (type, key) => createHash('sha1').update(`${type}|${key}`).digest('hex').slice(0, 12);

function normalizeStart(input) {
  let s = String(input || '').trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  const u = new URL(s);
  u.hash = '';
  return u.href;
}

async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

function decodeXml(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").trim();
}

export async function scan(startInput, options = {}, onEvent = () => {}) {
  const opts = { ...DEFAULTS, ...options };
  const now = opts.now ? new Date(opts.now) : new Date();
  const f = createFetcher(opts);
  const emit = (e) => { try { onEvent(e); } catch {} };
  const ignored = (url) => opts.ignore.some((p) => url.includes(p));

  let start = normalizeStart(startInput);
  emit({ type: 'phase', phase: 'knocking', url: start });

  // Land on the real home page first (http→https, apex→www, etc.)
  let home = await f.follow(start, { readBody: true });
  // No scheme given and https failed? Some sites only speak http.
  const typedScheme = /^https?:\/\//i.test(String(startInput).trim());
  if (!typedScheme && (home.error || !home.status) && home.error !== 'blocked') {
    const plain = start.replace(/^https:/, 'http:');
    const retry = await f.follow(plain, { readBody: true });
    if (!retry.error && retry.status && retry.status < 400) { start = plain; home = retry; }
  }
  if (home.error || !home.status || home.status >= 400) {
    const why = {
      ENOTFOUND: 'no website exists at that address',
      ECONNREFUSED: 'the site refused the connection',
      timeout: 'the site took too long to answer',
      blocked: 'private network addresses are not allowed here',
      ECONNRESET: 'the connection was cut off',
    }[home.error] || (/SSL|CERT|TLS/i.test(home.error || '') ? 'its secure connection (https) failed' : null)
      || (home.error ? home.error : `it answered with status ${home.status}`);
    throw new Error(`Couldn't open ${start}: ${why}.`);
  }
  const homeUrl = home.finalUrl;
  const origin = new URL(homeUrl);
  const siteHost = stripWww(origin.hostname);
  const sameSite = (url) => { try { return stripWww(new URL(url).hostname) === siteHost; } catch { return false; } };

  // robots.txt
  let robots = parseRobots('');
  const rob = await f.follow(`${origin.origin}/robots.txt`, { readBody: true });
  if (rob.status === 200 && rob.body && !/<html/i.test(rob.body)) robots = parseRobots(rob.body);
  const allowed = (url) => {
    if (!opts.respectRobots || !sameSite(url)) return true;
    const u = new URL(url);
    return robots.isAllowed(u.pathname + u.search);
  };

  // Sitemap
  emit({ type: 'phase', phase: 'reading the map' });
  const fromSitemap = [];
  const sitemapQueue = robots.sitemaps.length ? [...robots.sitemaps] : [`${origin.origin}/sitemap.xml`];
  const sitemapSeen = new Set();
  while (sitemapQueue.length && sitemapSeen.size < 10 && fromSitemap.length < opts.maxPages * 3) {
    const sm = sitemapQueue.shift();
    if (sitemapSeen.has(sm)) continue;
    sitemapSeen.add(sm);
    const r = await f.follow(sm, { readBody: true });
    if (r.status !== 200 || !r.body) continue;
    const locs = [...r.body.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => decodeXml(m[1]));
    if (/<sitemapindex/i.test(r.body)) sitemapQueue.push(...locs);
    else fromSitemap.push(...locs.filter(sameSite));
  }

  // Crawl pages in waves
  const linkResults = new Map(); // url -> follow() result, so we don't fetch twice
  const linksFound = new Map(); // url -> Set(pages it appears on)
  const linkMeta = new Map(); // url -> { href, text, page } as first seen
  const findings = [];
  const visited = new Set();
  const pages = [];
  let robotsSkipped = 0;

  linkResults.set(start, home);
  linkResults.set(homeUrl, home);
  let frontier = [homeUrl, ...fromSitemap];
  const sitemapSet = new Set(fromSitemap);

  const crawlPage = async (url) => {
    let r = linkResults.get(url);
    if (!r || r.body === undefined) {
      r = await f.follow(url, { readBody: true });
      linkResults.set(url, r);
    }
    emit({ type: 'page', url, pagesScanned: pages.length + 1 });
    if (r.error || r.status >= 400) {
      // A page the sitemap promises but can't deliver is a ghost too.
      if (sitemapSet.has(url)) {
        const set = linksFound.get(url) || new Set();
        set.add('sitemap.xml');
        linksFound.set(url, set);
      }
      return;
    }
    if (!/html/i.test(r.contentType || '') || !r.body) return;
    const finalUrl = r.finalUrl || url;
    if (!sameSite(finalUrl)) return;
    visited.add(finalUrl);
    pages.push(finalUrl);
    const a = analyzePage(r.body, finalUrl, { now, quietPaths: opts.quietPaths });
    for (const fd of a.findings) findings.push({ ...fd, page: finalUrl });
    for (const link of a.links) {
      if (ignored(link)) continue;
      if (!linkMeta.has(link) && a.linkMeta[link]) linkMeta.set(link, { ...a.linkMeta[link], page: finalUrl });
      const set = linksFound.get(link) || new Set();
      set.add(finalUrl);
      linksFound.set(link, set);
    }
  };

  while (frontier.length && pages.length < opts.maxPages) {
    const batch = [];
    for (const url of frontier) {
      if (batch.length + pages.length >= opts.maxPages) break;
      if (visited.has(url) || NON_PAGE.test(url) || !sameSite(url) || ignored(url)) continue;
      visited.add(url);
      if (!allowed(url)) { robotsSkipped++; continue; }
      batch.push(url);
    }
    if (!batch.length) break;
    emit({ type: 'phase', phase: 'walking the halls' });
    await pool(batch, opts.concurrency, crawlPage);
    frontier = [...linksFound.keys()].filter((u) => sameSite(u) && !visited.has(u));
  }
  const capped = frontier.some((u) => !visited.has(u) && !NON_PAGE.test(u));

  // Check every link
  // Your own links first, so a cap never skips them in favour of other sites.
  let toCheck = [...linksFound.keys()]
    .filter((u) => (opts.external || sameSite(u)) && allowed(u))
    .sort((a, b) => Number(sameSite(b)) - Number(sameSite(a)));
  const linksTotal = toCheck.length;
  const linksCapped = toCheck.length > opts.maxLinks;
  toCheck = toCheck.slice(0, opts.maxLinks);
  emit({ type: 'phase', phase: 'knocking on every door', linksTotal: toCheck.length });

  const ghosts = new Map();
  const addGhost = (type, key, foundOn, extra = {}) => {
    const id = ghostId(type, key);
    const existing = ghosts.get(id);
    if (existing) {
      for (const p of foundOn) if (!existing.foundOn.includes(p)) existing.foundOn.push(p);
      return;
    }
    const { label, fix } = describe(type, extra.data);
    if (type !== 'locked') emit({ type: 'presence', kind: type, url: extra.url || foundOn[0] || null });
    ghosts.set(id, {
      id,
      type,
      name: GHOST_TYPES[type].name,
      confidence: extra.confidence || GHOST_TYPES[type].confidence,
      url: extra.url || null,
      foundOn: [...foundOn],
      label,
      fix,
      quote: extra.quote || null,
      detail: extra.detail || null,
    });
  };

  let checked = 0;
  await pool(toCheck, opts.concurrency, async (url) => {
    const foundOn = [...linksFound.get(url)];
    // A link like https://n/ is a typo, not a site. Don't bother knocking.
    if (isMalformed(url)) {
      checked++;
      emit({ type: 'link', url, status: 'broken', linksChecked: checked, linksTotal: toCheck.length });
      addGhost('dead', url, foundOn, { url, data: { reason: 'malformed' }, detail: { error: 'malformed', evidence: linkMeta.get(url) || null } });
      return;
    }
    let r = linkResults.get(url);
    if (!r) { r = await f.follow(url); linkResults.set(url, r); }
    checked++;
    emit({ type: 'link', url, status: r.loop ? 'loop' : (r.status || r.error || null), hops: r.hops ? r.hops.length : 0, linksChecked: checked, linksTotal: toCheck.length });
    let g = classifyLink(r, url, opts.botShy, sameSite(url));
    // Before calling anything dead by its status code, ask once more the way a browser would.
    // If a person would get the page, it isn't dead; if the site now refuses us, we can't tell.
    if (g && g.type === 'dead' && r.status) {
      const again = await f.follow(url, { browser: true });
      if (!again.error && again.status < 400) g = classifyLink(again, url, opts.botShy, sameSite(url));
      else if (again.status === 404 || again.status === 410) g.detail = { ...g.detail, verified: 'checked twice, the second time as a browser' };
      else if (again.status !== r.status) g = { type: 'locked', detail: { ...g.detail, status: again.status ?? r.status, reason: 'answers bots and browsers differently' } };
    }
    if (g) {
      const ev = linkMeta.get(url);
      if (ev) g.detail = { ...(g.detail || {}), evidence: ev };
      addGhost(g.type, url, foundOn, { url, data: g.data, confidence: g.confidence, detail: g.detail });
    }
  });

  for (const fd of findings) {
    if (fd.type === 'nameless' || fd.type === 'speechless') {
      addGhost(fd.type, fd.key, [fd.page], { url: fd.page });
    } else {
      addGhost(fd.type, fd.key, [fd.page], { quote: fd.quote, data: fd.data, confidence: fd.confidence, url: fd.page });
    }
  }

  const list = sortGhosts([...ghosts.values()]);
  const real = list.filter((g) => g.type !== 'locked');
  const result = {
    site: origin.origin,
    startUrl: start,
    scannedAt: now.toISOString(),
    pagesScanned: pages.length,
    linksChecked: checked,
    ghostCount: real.length,
    lockedCount: list.length - real.length,
    ...scoreGhosts(list),
    limits: { pagesCapped: capped, linksCapped, linksTotal, maxLinks: opts.maxLinks, robotsSkipped, maxPages: opts.maxPages, external: opts.external },
    ghosts: list,
  };
  emit({ type: 'done', result });
  return result;
}

export function isMalformed(url) {
  try {
    const host = new URL(url).hostname;
    if (host === 'localhost' || /^[\d.]+$/.test(host) || host.startsWith('[')) return false;
    return !host.includes('.');
  } catch {
    return true;
  }
}

const hostMatches = (url, domains) => {
  try {
    const h = new URL(url).hostname.replace(/^www\./, '');
    return domains.some((d) => h === d || h.endsWith('.' + d));
  } catch { return false; }
};

export function classifyLink(r, url = r.finalUrl, botShy = DEFAULTS.botShy, internal = true) {
  if (['blocked', 'bad-url', 'unsupported'].includes(r.error)) return null;
  const hops = r.hops?.length || 0;
  const detail = { status: r.status ?? null, hops: r.hops || [], finalUrl: r.finalUrl, error: r.error || null };
  // Social sites show bots a 404 or a login wall for pages that work fine for people.
  // We can't tell, so we never call them dead.
  if (hostMatches(url, botShy) && (r.error || r.status >= 400)) {
    return { type: 'locked', detail: { ...detail, reason: 'this site hides pages from bots' } };
  }
  if (r.loop) return { type: 'chain', data: { loop: true }, detail };
  if (r.error) {
    if (r.error === 'ENOTFOUND') return { type: 'dead', data: { reason: 'dns' }, detail };
    const why = { timeout: 'no answer within 10 seconds', ECONNREFUSED: 'refused the connection', ECONNRESET: 'cut the connection' }[r.error]
      || (/SSL|CERT|TLS/i.test(r.error) ? 'secure connection failed' : r.error);
    return { type: 'locked', detail: { ...detail, reason: why } };
  }
  // Bot walls (Cloudflare, AWS WAF, rate limits) are not dead pages.
  if (r.challenge || r.status === 429 || r.status === 403 || r.status === 401 || r.status === 999) {
    return { type: 'locked', detail: { ...detail, reason: r.status === 429 ? 'rate limited' : r.challenge ? 'bot check' : `status ${r.status}` } };
  }
  if (r.status === 404 || r.status === 410) return { type: 'dead', data: { status: r.status }, detail };
  // 503 and Cloudflare's 52x are usually "busy" or bot protection; other server errors may be temporary.
  if (r.status === 503 || (r.status >= 520 && r.status <= 530)) return { type: 'locked', detail: { ...detail, reason: `server busy (status ${r.status})` } };
  if (r.status >= 500) return { type: 'dead', confidence: 'maybe', data: { status: r.status }, detail: { ...detail, note: 'server error; may be temporary' } };
  if (r.status >= 400) return { type: 'locked', detail: { ...detail, reason: `status ${r.status}` } };
  if (!hops) return null;
  if (internal) {
    // Your own site: every extra hop is yours to fix.
    return hops >= 2 ? { type: 'chain', data: { hops, finalUrl: r.finalUrl }, detail } : null;
  }
  // Other sites: only flag what changes what a reader gets.
  if (isAuthWall(r.finalUrl)) return null; // ends on a login page; linking there would be worse
  const from = baseDomain(url);
  const to = baseDomain(r.finalUrl);
  // Short links (youtu.be, bit.ly) are meant to land somewhere else.
  if (SHORTENERS.has(from)) return null;
  // Same name, new ending (outreach.io → outreach.ai) is the same company, not a takeover.
  const sameName = from.split('.')[0] === to.split('.')[0];
  if (from && to && from !== to && !sameName) {
    return { type: 'possessed', data: { finalHost: hostOf(r.finalUrl), finalUrl: r.finalUrl }, detail };
  }
  const real = meaningfulHops(url, r);
  return real >= 2 ? { type: 'chain', data: { hops: real, finalUrl: r.finalUrl }, detail } : null;
}

const SHORTENERS = new Set(['youtu.be', 'bit.ly', 't.co', 'lnkd.in', 'buff.ly', 'goo.gl', 'g.co', 'amzn.to', 'ow.ly',
  'tinyurl.com', 'rebrand.ly', 'cutt.ly', 'shorturl.at', 'is.gd', 'rb.gy', 'tiny.cc', 'spoti.fi', 'apple.co', 'fb.me', 'wa.me', 'calendly.com']);

const hostOf = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };

// example.com from shop.example.com; handles two-part endings like co.uk roughly.
export function baseDomain(url) {
  const host = hostOf(url);
  if (!host || /^[\d.]+$/.test(host) || !host.includes('.')) return host;
  const parts = host.split('.');
  const last2 = parts.slice(-2);
  if (parts.length >= 3 && last2[1].length === 2 && last2[0].length <= 3) return parts.slice(-3).join('.');
  return last2.join('.');
}

const AUTH = /(^|[./])(login|signin|sign-in|log-in|auth|sso|oauth)([./?#-]|$)|accounts\.google\.com|\/session/i;
export function isAuthWall(url) {
  try {
    const u = new URL(url);
    return AUTH.test(u.hostname) || AUTH.test(u.pathname);
  } catch { return false; }
}

// http→https, adding www and adding a trailing slash don't count as a real move.
export function meaningfulHops(url, r) {
  const key = (x) => {
    try {
      const u = new URL(x);
      return u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '') + u.search;
    } catch { return x; }
  };
  const seq = [url, ...(r.hops || []).slice(1).map((h) => h.url), r.finalUrl].map(key);
  let n = 0;
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) n++;
  return n;
}
