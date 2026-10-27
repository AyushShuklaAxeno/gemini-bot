import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGithubReviewPayload } from './githubPayload.mjs';

const findings = [
  { file: 'a.js', line: 5, severity: 'high', summary: 'Bug', suggestion: 'Fix' },
  { file: 'b.js', line: 9, severity: 'low', summary: 'Nit', suggestion: '' },
];

test('builds a review payload with commit_id and COMMENT event', () => {
  const payload = buildGithubReviewPayload(findings, { commitSha: 'deadbeef' });
  assert.equal(payload.commit_id, 'deadbeef');
  assert.equal(payload.event, 'COMMENT');
});

test('maps each finding to a comment with path/line/side/body', () => {
  const payload = buildGithubReviewPayload(findings, { commitSha: 'deadbeef' });
  assert.equal(payload.comments.length, 2);
  assert.equal(payload.comments[0].path, 'a.js');
  assert.equal(payload.comments[0].line, 5);
  assert.equal(payload.comments[0].side, 'RIGHT');
  assert.match(payload.comments[0].body, /Bug/);
});

test('empty findings still produces a valid payload with zero comments', () => {
  const payload = buildGithubReviewPayload([], { commitSha: 'deadbeef' });
  assert.deepEqual(payload.comments, []);
  assert.match(payload.body, /found no issues/);
});
