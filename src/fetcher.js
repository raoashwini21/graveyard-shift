// HTTP layer: timeouts, manual redirect following (so we can count hops),
// HEAD-then-GET fallback, one retry, per-host politeness delay, and an
// optional guard that refuses private network addresses (for hosted use).

import dns from 'node:dns/promises';
import net from 'node:net';

export const USER_AGENT =
  'GraveyardShift/0.1 (site health scanner; +https://github.com/raoashwini21/graveyard-shift)';
// Used only to double-check a link that looked dead, because some sites answer bots differently than people.
export const BROWSER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

const MAX_HOPS = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  if (v === '::1' || v === '::') return true;
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v.startsWith('fe80') || v.startsWith('fc') || v.startsWith('fd');
}

// Errors that mean "we didn't get an answer", worth one retry.
const NO_RETRY = new Set(['blocked', 'bad-url', 'unsupported']);

export function createFetcher({ timeoutMs = 10000, delayMs = 150, allowPrivate = true } = {}) {
  const hostOk = new Map();
  const nextSlot = new Map();

  async function hostAllowed(hostname) {
    if (allowPrivate) return true;
    const host = hostname.replace(/^\[|\]$/g, '');
    if (hostOk.has(host)) return hostOk.get(host);
    let ok = true;
    if (net.isIP(host)) ok = !isPrivateIp(host);
    else {
      try {
        const addrs = await dns.lookup(host, { all: true });
        ok = addrs.every((a) => !isPrivateIp(a.address));
      } catch {
        ok = true; // let the real request fail with a DNS error
      }
    }
    hostOk.set(host, ok);
    return ok;
  }

  async function throttle(host) {
    const now = Date.now();
    const slot = Math.max(now, nextSlot.get(host) || 0);
    nextSlot.set(host, slot + delayMs);
    if (slot > now) await sleep(slot - now);
  }

  async function readLimited(res, maxBytes) {
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      if (size >= maxBytes) {
        try { await reader.cancel(); } catch {}
        break;
      }
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  async function request(url, method, { readBody = false, maxBytes = 2_000_000, browser = false } = {}) {
    let u;
    try { u = new URL(url); } catch { return { error: 'bad-url' }; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { error: 'unsupported' };
    if (!(await hostAllowed(u.hostname))) return { error: 'blocked' };
    await throttle(u.host);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(u, {
        method,
        redirect: 'manual',
        signal: ctrl.signal,
        headers: browser
          ? { 'user-agent': BROWSER_AGENT, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'accept-language': 'en-US,en;q=0.9' }
          : { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      });
      const out = {
        status: res.status,
        location: res.headers.get('location'),
        contentType: res.headers.get('content-type') || '',
        server: (res.headers.get('server') || '').toLowerCase(),
        challenge: Boolean(res.headers.get('cf-mitigated') || res.headers.get('x-amzn-waf-action')),
      };
      if (readBody && res.body && res.status < 300) out.body = await readLimited(res, maxBytes);
      else { try { await res.body?.cancel(); } catch {} }
      return out;
    } catch (e) {
      if (e.name === 'AbortError') return { error: 'timeout' };
      return { error: e.cause?.code || e.code || e.message || 'network-error' };
    } finally {
      clearTimeout(timer);
    }
  }

  // Follow redirects by hand so we can report each hop.
  async function followOnce(url, { readBody = false, browser = false } = {}) {
    const hops = [];
    const seen = new Set([url]);
    let current = url;
    for (let i = 0; i < MAX_HOPS; i++) {
      let r = readBody || browser
        ? await request(current, 'GET', { readBody, browser })
        : await request(current, 'HEAD');
      // Many servers mishandle HEAD (405, 403, 404, or just hang). Ask again with GET.
      if (!readBody && !browser && !NO_RETRY.has(r.error) && (r.error || r.status >= 400)) {
        const g = await request(current, 'GET');
        if (!g.error || r.error) r = g;
      }
      if (r.status >= 300 && r.status < 400 && r.location) {
        let next;
        try { next = new URL(r.location, current).href.split('#')[0]; } catch { return { ...r, hops, finalUrl: current }; }
        hops.push({ url: current, status: r.status });
        if (seen.has(next)) return { loop: true, hops, finalUrl: next };
        seen.add(next);
        current = next;
        continue;
      }
      return { ...r, hops, finalUrl: current };
    }
    return { loop: true, tooManyHops: true, hops, finalUrl: current };
  }

  // One retry for errors and 5xx, so a blip doesn't become a "dead" link.
  async function follow(url, opts) {
    let r = await followOnce(url, opts);
    if ((r.error && !NO_RETRY.has(r.error)) || r.status >= 500) {
      await sleep(1000);
      const again = await followOnce(url, opts);
      if (!again.error || r.error) r = again;
    }
    return r;
  }

  return { request, follow };
}
