// What changed since last week, worked out carefully:
// - New Arrivals: ghosts that weren't there last time.
// - Still Haunting: ghosts that were there last time and still are (with the date first seen).
// - Laid to Rest: ghosts from last time that are gone AND whose pages were checked again this time.
//   If we didn't get to re-check a ghost's page (page limit, page failed to load), we never call it fixed;
//   it is carried forward quietly instead.
// - Fix This First: the most important ghost, weighted towards money pages (pricing, signup, contact, demo).

// A money page is one whose own address starts with these words: /pricing, /signup, /book-a-demo, /contact-sales.
// Blog posts never count, even if their title contains "buy" or "pricing".
const MONEY = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(pricing|plans?|sign-?up|register|get-?started|start-trial|free-trial|trial|demo|book-a-demo|book-demo|contact|contact-sales|talk-to-sales|checkout|buy|subscribe|upgrade)(?:[/?#]|-|$)/i;
const BLOG = /^\/(?:[a-z]{2}\/)?(blogs?|news|articles?|posts?|resources|guides?|learn)\//i;
const isMoney = (u) => { const p = pathOf(u); return !BLOG.test(p) && MONEY.test(p); };
const WEIGHT = { dead: 100, possessed: 70, 'past-event': 60, nameless: 50, 'stale-year': 30, chain: 25, speechless: 15 };

export const pathOf = (u) => { try { return new URL(u).pathname; } catch { return u || ''; } };

export function priority(g) {
  let p = WEIGHT[g.type] || 0;
  if (isImportant(g)) p += 80;
  if (pathOf(g.foundOn?.[0]) === '/') p += 20; // on the home page, everyone sees it
  p += Math.min(g.foundOn?.length || 1, 10) * 3; // on many pages
  if (g.confidence === 'maybe') p -= 300; // never lead with something uncertain if anything certain exists
  return p;
}
// The ghost sits on a money page, or breaks a link that points to one of your money pages.
export const isImportant = (g) => (g.foundOn || []).some(isMoney) || (g.url && isMoney(g.url) && /^https?:/.test(g.url) && (g.foundOn || []).some((p) => { try { return new URL(p).host === new URL(g.url).host; } catch { return false; } }));

// The small record of a ghost kept between weeks.
export const remember = (g, firstSeen) => ({
  id: g.id, type: g.type, name: g.name, label: g.label, url: g.url, quote: g.quote || null,
  foundOn: (g.foundOn || []).slice(0, 5), firstSeen,
});

export function digest(prev, result) {
  const now = result.scannedAt;
  const ghosts = result.ghosts.filter((g) => g.type !== 'locked');
  const before = new Map((prev?.ghosts || []).map((g) => [g.id, g]));
  const scanned = new Set((result.pages || []).map((u) => u.replace(/\/$/, '')));
  const checkedAgain = (old) => {
    if (!old.foundOn || !old.foundOn.length) return !result.limits?.pagesCapped; // older record: trust only a full scan
    return old.foundOn.every((p) => p === 'sitemap.xml' ? true : scanned.has(String(p).replace(/\/$/, '')));
  };
  const added = [], still = [];
  for (const g of ghosts) {
    const old = before.get(g.id);
    if (old) still.push({ ...g, firstSeen: old.firstSeen || prev.scannedAt || null });
    else added.push({ ...g, firstSeen: now });
  }
  const current = new Set(ghosts.map((g) => g.id));
  const resolved = [], carried = [];
  for (const old of before.values()) {
    if (current.has(old.id)) continue;
    (checkedAgain(old) ? resolved : carried).push(old);
  }
  const pool = prev ? added : ghosts;
  const fixFirst = [...(pool.length ? pool : ghosts)].sort((a, b) => priority(b) - priority(a))[0] || null;
  const state = {
    site: result.site,
    scannedAt: now,
    ghosts: [...added.map((g) => remember(g, now)), ...still.map((g) => remember(g, g.firstSeen)), ...carried],
  };
  return { firstRun: !prev, added, still, resolved, carried, fixFirst, state, result };
}

// Should this week's scan email anyone? By default only when something new moved in.
// mode: 'new' (default) | 'changes' (new or laid to rest) | 'always'
export function worthSending(d, mode = 'new') {
  if (mode === 'always') return true;
  if (d.firstRun) return d.added.length > 0;
  if (mode === 'changes') return d.added.length > 0 || d.resolved.length > 0;
  return d.added.length > 0;
}
