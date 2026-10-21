import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haunt, decodeState, LABEL } from '../src/haunt.js';
import { digest, worthSending, priority } from '../src/digest.js';
import { digestMarkdown, cardTitle } from '../src/haunt.js';

// An in-memory GitHub that records what would be emailed.
function fakeGitHub() {
  const issues = [];
  const emails = [];
  return {
    issues,
    emails,
    async ensureLabel() {},
    async findOpenIssue(label) { return issues.find((i) => i.state === 'open' && i.labels.includes(label)) || null; },
    async createIssue({ title, body, labels }) {
      const i = { number: issues.length + 1, title, body, labels, state: 'open', comments: [] };
      issues.push(i);
      emails.push(`opened: ${title}`);
      return i;
    },
    async updateIssue(n, data) { Object.assign(issues[n - 1], data); return issues[n - 1]; },
    async comment(n, body) { issues[n - 1].comments.push(body); emails.push(`comment: ${body.split('\n')[0]}`); },
  };
}

const ghost = (id, extra = {}) => ({
  id, type: 'dead', name: 'Dead link', confidence: 'confirmed', url: `https://ex.com/${id}`,
  foundOn: ['https://ex.com/'], label: 'This page left no forwarding address.', fix: 'Remove the link.', quote: null, ...extra,
});
const scanOf = (ghosts) => ({
  site: 'https://ex.com', scannedAt: '2026-10-20T00:00:00Z', pagesScanned: 5, linksChecked: 20, pages: ['https://ex.com/', 'https://ex.com/pricing'],
  ghostCount: ghosts.filter((g) => g.type !== 'locked').length, score: 10, rank: 'Restless', limits: {}, ghosts,
});

test('the weekly haunt only emails you when something changes', async () => {
  const gh = fakeGitHub();

  // Week 1: two ghosts, the issue opens (one email)
  let out = await haunt(scanOf([ghost('a'), ghost('b')]), gh);
  assert.equal(out.action, 'opened');
  assert.equal(gh.emails.length, 1);
  assert.match(gh.issues[0].title, /Wisp found 2 ghosts haunting ex\.com/);
  assert.deepEqual(decodeState(gh.issues[0].body).ghosts.map((g) => g.id), ['a', 'b']);
  assert.ok(gh.issues[0].labels.includes(LABEL));

  // Week 2: nothing new, updated quietly (no email)
  out = await haunt(scanOf([ghost('a'), ghost('b')]), gh);
  assert.equal(out.action, 'updated quietly');
  assert.equal(gh.emails.length, 1);

  // Week 3: one fixed, one new. A comment lists only the new one.
  out = await haunt(scanOf([ghost('a'), ghost('c')]), gh);
  assert.equal(out.action, 'haunted');
  assert.equal(out.added, 1);
  assert.equal(out.banished, 1);
  assert.equal(gh.emails.length, 2);
  const c = gh.issues[0].comments[0];
  assert.match(c, /A new ghost moved into ex\.com/);
  assert.match(c, /\/c/);
  assert.equal(c.includes('/a`'), false);
  assert.match(c, /Laid to rest/);
  assert.match(gh.issues[0].title, /A new ghost moved into ex\.com/, 'the title (email subject) says what is new');

  // Locked doors never count as new ghosts
  out = await haunt(scanOf([ghost('a'), ghost('c'), ghost('z', { type: 'locked', name: 'Locked door' })]), gh);
  assert.equal(out.action, 'updated quietly');

  // Week 4: all fixed. At peace, issue closed.
  out = await haunt(scanOf([]), gh);
  assert.equal(out.action, 'closed');
  assert.equal(gh.issues[0].state, 'closed');
  assert.match(gh.issues[0].comments.at(-1), /at peace/);

  // Week 5: still at peace, nothing happens
  out = await haunt(scanOf([]), gh);
  assert.equal(out.action, 'none');
  assert.equal(gh.issues.length, 1);

  // Week 6: a ghost returns, a fresh issue opens
  out = await haunt(scanOf([ghost('d')]), gh);
  assert.equal(out.action, 'opened');
  assert.equal(gh.issues.length, 2);
});

test('switching to a different site closes the old issue and opens a fresh one', async () => {
  const gh = fakeGitHub();
  await haunt(scanOf([ghost('a')]), gh);
  const other = { ...scanOf([ghost('x')]), site: 'https://other.com' };
  const out = await haunt(other, gh);
  assert.equal(out.action, 'opened');
  assert.equal(gh.issues[0].state, 'closed');
  assert.match(gh.issues[1].title, /other\.com/);
});

test('the haunt @mentions you so GitHub actually emails you', async () => {
  const gh = fakeGitHub();
  await haunt(scanOf([ghost('a')]), gh, { mention: 'raoashwini21' });
  assert.match(gh.issues[0].body, /@raoashwini21/);
  await haunt(scanOf([ghost('a'), ghost('b')]), gh, { mention: 'raoashwini21' });
  assert.match(gh.issues[0].comments[0], /@raoashwini21/);
  // other sites' links show the full address, your own pages just the path
  await haunt(scanOf([ghost('a'), ghost('b'), ghost('n', { url: 'https://n/' })]), gh, { mention: 'raoashwini21' });
  assert.match(gh.issues[0].comments[1], /<code>https:\/\/n\/<\/code>/);
  assert.match(gh.issues[0].body, /`\/a`/);
});

test('a ghost is only laid to rest if its page was checked again', () => {
  const prev = digest(null, scanOf([ghost('a'), ghost('b', { foundOn: ['https://ex.com/deep'] })])).state;
  // This week the scan never reached /deep, and neither ghost appears.
  const d = digest(prev, scanOf([]));
  assert.deepEqual(d.resolved.map((g) => g.id), ['a']);
  assert.deepEqual(d.carried.map((g) => g.id), ['b'], 'unchecked ghost is carried, never claimed fixed');
  assert.ok(d.state.ghosts.some((g) => g.id === 'b'), 'and remembered for next time');
});

test('fix this first leads with money pages and never with an uncertain finding', () => {
  const blog = ghost('blog', { foundOn: ['https://ex.com/blog/x'] });
  const pricing = ghost('pricing', { type: 'chain', foundOn: ['https://ex.com/pricing'] });
  const unsure = ghost('unsure', { confidence: 'maybe', foundOn: ['https://ex.com/signup'] });
  assert.equal(digest(null, scanOf([blog, pricing, unsure])).fixFirst.id, 'pricing');
  assert.ok(priority(pricing) > priority(blog));
});

test('the weekly card: creative title, three-part summary, and only when something new arrives', () => {
  const prev = digest(null, scanOf([ghost('a'), ghost('b')])).state;
  const d = digest(prev, scanOf([ghost('a'), ghost('c'), ghost('d', { confidence: 'maybe' })]));
  assert.equal(cardTitle(d), '👻 2 new ghosts moved into ex.com');
  assert.equal(d.added.length, 2); assert.equal(d.still.length, 1); assert.equal(d.resolved.length, 1);
  const md = digestMarkdown(d, 'me', { reportUrl: 'https://github.com/o/r/issues/1', turnOffUrl: 'https://github.com/o/r/actions' });
  for (const s of ['NEW ARRIVALS', 'STILL HAUNTING', 'LAID TO REST', 'Fix this first', 'View the full investigation', 'disable the workflow', 'needs review', 'spirit-dead.png', '@me']) assert.ok(md.includes(s), s);
  const quiet = digest(d.state, scanOf([ghost('a'), ghost('c'), ghost('d', { confidence: 'maybe' })]));
  assert.equal(worthSending(quiet), false);
  assert.equal(worthSending(d), true);
});

test('money pages are real money pages, never blog posts with "buy" in the title', async () => {
  const { isImportant } = await import('../src/digest.js');
  const on = (p) => ghost('x', { foundOn: ['https://ex.com' + p] });
  for (const p of ['/pricing', '/signup', '/book-a-demo', '/contact-sales', '/en/pricing', '/checkout/step-2']) assert.ok(isImportant(on(p)), p);
  for (const p of ['/blogs/buy-linkedin-accounts', '/blog/pricing-strategies', '/startups', '/about', '/blogs/how-to-book-a-demo']) assert.ok(!isImportant(on(p)), p);
  // a dead link on a blog post that points to your own pricing page does matter
  assert.ok(!isImportant(ghost('y', { url: 'https://other.com/pricing', foundOn: ['https://ex.com/blog/x'] })), 'someone else\'s pricing page is not yours');
  assert.ok(isImportant(ghost('z', { url: 'https://ex.com/pricing', foundOn: ['https://ex.com/blog/x'] })));
});
