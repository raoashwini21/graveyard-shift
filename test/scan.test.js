import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureSite } from './fixture-site.js';
import { scan } from '../src/scan.js';
import { parseRobots } from '../src/robots.js';

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
  assert.ok(['Restless', 'Haunted', 'Possessed', 'Cursed'].includes(result.rank));
});

test('robots parser: longest match wins, allow beats disallow on a tie', () => {
  const r = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/ok\nDisallow: /*.pdf$\n');
  assert.equal(r.isAllowed('/private/x'), false);
  assert.equal(r.isAllowed('/private/ok/page'), true);
  assert.equal(r.isAllowed('/a.pdf'), false);
  assert.equal(r.isAllowed('/a.pdf?x=1'), true);
  assert.equal(r.isAllowed('/'), true);
});
