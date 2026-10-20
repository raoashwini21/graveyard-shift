import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haunt, decodeState, LABEL } from '../src/haunt.js';

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
  site: 'https://ex.com', scannedAt: '2026-10-20T00:00:00Z', pagesScanned: 5, linksChecked: 20,
  ghostCount: ghosts.filter((g) => g.type !== 'locked').length, score: 10, rank: 'Restless', limits: {}, ghosts,
});

test('the weekly haunt only emails you when something changes', async () => {
  const gh = fakeGitHub();

  // Week 1: two ghosts, the issue opens (one email)
  let out = await haunt(scanOf([ghost('a'), ghost('b')]), gh);
  assert.equal(out.action, 'opened');
  assert.equal(gh.emails.length, 1);
  assert.match(gh.issues[0].title, /2 ghosts haunt ex\.com/);
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
  assert.match(c, /1 new ghost moved into ex\.com/);
  assert.match(c, /\/c/);
  assert.equal(c.includes('/a`'), false);
  assert.match(c, /1 ghost was banished/);
  assert.match(gh.issues[0].title, /2 ghosts haunt ex\.com/);

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
