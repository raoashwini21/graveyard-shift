import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureSite } from './fixture-site.js';
import { scan, classifyLink, isMalformed, baseDomain, meaningfulHops } from '../src/scan.js';
import { toText } from '../src/report.js';
import { parseRobots } from '../src/robots.js';
import { copyrightNotice } from '../src/checks.js';

let site;
let result;
const path = (u) => (u ? new URL(u).pathname : null);
const find = (type, p) => result.ghosts.find((g) => g.type === type && path(g.url) === p);

before(async () => {
  site = await startFixtureSite();
  result = await scan(site.url, { now: '2026-10-20T12:00:00Z', delayMs: 0, timeoutMs: 4000 });
});
after(() => site.server.close());

test('finds dead links (404, 410, 500) and dead pages listed in the sitemap', () => {
  assert.ok(find('dead', '/old-page'), '404');
  assert.ok(find('dead', '/gone'), '410');
  assert.ok(find('dead', '/broken'), '500');
  const sm = find('dead', '/ghost-page');
  assert.ok(sm, 'sitemap 404');
  assert.deepEqual(sm.foundOn, ['sitemap.xml']);
});

test('finds redirect chains and loops, but not a single redirect', () => {
  const chain = find('chain', '/hop1');
  assert.ok(chain);
  assert.match(chain.label, /3 hops/);
  assert.match(chain.fix, /\/about$/);
  assert.ok(find('chain', '/loop-a'), 'loop');
  assert.equal(result.ghosts.some((g) => path(g.url) === '/moved'), false);
});

test('a bot-blocked link is a locked door, not a dead link', () => {
  assert.ok(find('locked', '/private'));
  assert.equal(find('dead', '/private'), undefined);
});

test('slow pages, PDFs and fine pages are left alone', () => {
  for (const p of ['/slow', '/files/guide.pdf', '/about', '/events', '/register']) {
    assert.equal(result.ghosts.some((g) => g.type !== 'stale-year' && path(g.url) === p && g.type !== 'past-event'), false, p);
  }
});

test('missing title and description are found, but noindex pages are skipped', () => {
  assert.ok(find('nameless', '/untitled'));
  assert.ok(find('speechless', '/untitled'));
  assert.equal(result.ghosts.some((g) => path(g.url) === '/noindex-page'), false);
});

test('the old footer year is one ghost found on many pages', () => {
  const stale = result.ghosts.filter((g) => g.type === 'stale-year');
  assert.equal(stale.length, 1);
  assert.equal(stale[0].confidence, 'confirmed');
  assert.match(stale[0].label, /2022/);
  assert.ok(stale[0].foundOn.length >= 3);
  // "Founded in 2015", "since 2019" and "© 2019–2026" are not ghosts
  assert.equal(stale[0].quote.includes('2015'), false);
});

test('an invite to a past event is found; recordings, future events and blog posts are not', () => {
  const events = result.ghosts.filter((g) => g.type === 'past-event');
  assert.equal(events.length, 1, JSON.stringify(events, null, 2));
  assert.match(events[0].quote, /March 12, 2025/);
  assert.match(events[0].label, /March 2025/);
});

test('robots.txt is respected', () => {
  assert.equal(result.ghosts.some((g) => path(g.url) === '/admin'), false);
  assert.ok(result.limits.robotsSkipped >= 1);
});

test('score and rank', () => {
  assert.ok(result.score > 0);
  assert.ok(['Restless', 'Haunted', 'Infested', 'Cursed'].includes(result.rank));
});

test('robots parser: longest match wins, allow beats disallow on a tie', () => {
  const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\n');
  assert.equal(r.isAllowed('/private/x'), false);
  assert.equal(r.isAllowed('/private/ok/page'), true);
  assert.equal(r.isAllowed('/a.pdf'), false);
  assert.equal(r.isAllowed('/a.pdf?x=1'), true);
  assert.equal(r.isAllowed('/'), true);
});

test('accuracy: only real dead pages are called dead', () => {
  // 404 and 410 are confirmed, and double-checked as a browser
  assert.equal(find('dead', '/old-page').confidence, 'confirmed');
  assert.match(find('dead', '/old-page').detail.verified, /browser/);
  // a 500 might be temporary, so it is dead but needs review
  assert.equal(find('dead', '/broken').confidence, 'maybe');
  // a site that answers bots with 404 but people with the page is fine
  assert.ok(!result.ghosts.some((g) => path(g.url) === '/bot-shy'), 'bot-shy page must not be a ghost');
  // bot walls, rate limits, busy servers and forbidden pages are locked doors, never dead
  for (const p of ['/busy', '/rate', '/challenge', '/private']) {
    assert.ok(!find('dead', p), p + ' must not be dead');
    assert.ok(find('locked', p), p + ' should be a locked door');
  }
});

test('accuracy: classification of errors and statuses', () => {
  const c = (r, u = 'https://other.com/x') => classifyLink({ hops: [], finalUrl: u, ...r }, u, [], false);
  assert.equal(c({ error: 'timeout' }).type, 'locked');
  assert.equal(c({ error: 'ECONNRESET' }).type, 'locked');
  assert.equal(c({ error: 'ECONNREFUSED' }).type, 'locked');
  assert.equal(c({ error: 'ERR_SSL_WRONG_VERSION_NUMBER' }).type, 'locked');
  assert.equal(c({ error: 'ENOTFOUND' }).type, 'dead');
  for (const st of [401, 403, 429, 503, 520, 999]) assert.equal(c({ status: st }).type, 'locked', 'status ' + st);
  assert.equal(c({ status: 403, challenge: true }).type, 'locked');
  assert.equal(c({ status: 404 }).type, 'dead');
  assert.equal(c({ status: 502 }).confidence, 'maybe');
});

test('every dead link carries the exact link from the page as evidence', () => {
  const g = result.ghosts.find((x) => x.url === 'https://n/');
  assert.equal(g.detail.evidence.href, 'https://n');
  assert.equal(g.detail.evidence.text, 'Typo link');
  assert.ok(find('dead', '/old-page').detail.evidence.href);
});

test('a typo link like https://n/ is a broken address, found without fetching', () => {
  const g = result.ghosts.find((x) => x.url === 'https://n/');
  assert.ok(g);
  assert.equal(g.type, 'dead');
  assert.match(g.label, /address itself is broken/);
  assert.equal(isMalformed('https://example.com/a'), false);
  assert.equal(isMalformed('http://localhost:3000/'), false);
});

test('social sites are never called dead, only locked', () => {
  const r = { status: 404, hops: [], finalUrl: 'https://www.linkedin.com/company/x/' };
  assert.equal(classifyLink(r, r.finalUrl).type, 'locked');
  const other = { status: 404, hops: [], finalUrl: 'https://example.com/x' };
  assert.equal(classifyLink(other, other.finalUrl).type, 'dead');
});

test('locked doors are summarised by site in the text report', () => {
  const fake = {
    ...result,
    ghosts: [
      ...result.ghosts,
      ...[1, 2, 3].map((i) => ({ id: 'g' + i, type: 'locked', name: 'Locked door', confidence: 'unverified', url: `https://www.g2.com/p/${i}`, foundOn: ['https://a.com/'], label: 'x', fix: 'y' })),
    ],
  };
  const text = toText(fake);
  assert.match(text, /g2\.com \(3\)/);
  assert.equal(text.includes('https://www.g2.com/p/1'), false);
  assert.ok(toText(fake, { showLocked: true }).includes('https://www.g2.com/p/1'));
});

test('other sites: trivial http/www/slash hops and login walls are not ghosts', () => {
  const copyai = { status: 200, hops: [{ url: 'http://copy.ai/', status: 301 }, { url: 'https://copy.ai/', status: 301 }], finalUrl: 'https://www.copy.ai/' };
  assert.equal(meaningfulHops('http://copy.ai/', copyai), 0);
  assert.equal(classifyLink(copyai, 'http://copy.ai/', [], false), null);
  const login = { status: 200, hops: [{ url: 'https://www.autoklose.com/', status: 302 }, { url: 'https://autoklose.com/', status: 302 }], finalUrl: 'https://app.autoklose.com/login' };
  assert.equal(classifyLink(login, 'https://www.autoklose.com/', [], false), null);
  const gsheet = { status: 200, hops: [{ url: 'a', status: 302 }, { url: 'b', status: 302 }], finalUrl: 'https://accounts.google.com/v3/signin/identifier?x=1' };
  assert.equal(classifyLink(gsheet, 'https://docs.google.com/spreadsheets/create', [], false), null);
  // the same trivial chain on your own site is still yours to fix
  assert.equal(classifyLink(copyai, 'http://copy.ai/', [], true).type, 'chain');
});

test('a link that now lands on a different company is possessed', () => {
  const census = { status: 200, hops: [{ url: 'https://getcensus.com/', status: 301 }], finalUrl: 'https://www.fivetran.com/' };
  const g = classifyLink(census, 'https://getcensus.com/', [], false);
  assert.equal(g.type, 'possessed');
  assert.equal(g.data.finalHost, 'fivetran.com');
  const store = { status: 200, hops: [{ url: 'x', status: 301 }], finalUrl: 'https://chromewebstore.google.com/detail/a' };
  assert.equal(classifyLink(store, 'https://chrome.google.com/webstore/detail/a', [], false), null);
  assert.equal(baseDomain('https://shop.example.co.uk/x'), 'example.co.uk');
  // short links and same-name domain moves are not takeovers
  const yt = { status: 200, hops: [{ url: 'https://youtu.be/abc', status: 301 }], finalUrl: 'https://www.youtube.com/watch?v=abc' };
  assert.equal(classifyLink(yt, 'https://youtu.be/abc', [], false), null);
  const outreach = { status: 200, hops: [{ url: 'https://www.outreach.io/', status: 301 }], finalUrl: 'https://www.outreach.ai/' };
  assert.equal(classifyLink(outreach, 'https://www.outreach.io/', [], false), null);
});

test('a site given without a scheme falls back to http when https fails', async () => {
  const bare = site.url.replace('http://', '');
  const r = await scan(bare, { now: '2026-10-20T12:00:00Z', delayMs: 0, timeoutMs: 4000, maxPages: 2, external: false });
  assert.match(r.site, /^http:\/\//);
  assert.ok(r.pagesScanned >= 1);
});

test('the scan reports presences as ghosts are found, so the screen can react live', async () => {
  const events = [];
  await scan(site.url, { now: '2026-10-20T12:00:00Z', delayMs: 0, timeoutMs: 4000 }, (e) => events.push(e));
  const presences = events.filter((e) => e.type === 'presence');
  assert.ok(presences.length >= 8);
  assert.ok(presences.some((e) => e.kind === 'dead'));
  assert.ok(events.some((e) => e.type === 'link' && e.status === 404));
});

test('the copyright quote is just the notice, not the footer links after it', () => {
  assert.equal(copyrightNotice('© 2021 Moonbrew Coffee Co. All rights reserved. CareersGift cards LinkedIn'), '© 2021 Moonbrew Coffee Co. All rights reserved.');
  assert.equal(copyrightNotice('© 2022 Spooky Co. Privacy Terms'), '© 2022 Spooky Co. Privacy Terms');
  assert.equal(copyrightNotice('Made with love. © 2020 Acme Inc. Built in Pune.', 16), '© 2020 Acme Inc. Built in Pune.');
});
