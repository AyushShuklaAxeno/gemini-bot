import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCommentBody, formatSummaryBody } from './formatComment.mjs';

const finding = {
  file: 'server/src/index.js',
  line: 10,
  severity: 'high',
  summary: 'Null pointer on missing config.',
  suggestion: 'Add a guard before dereferencing config.db.',
};

test('formatCommentBody includes severity, summary, and commit sha', () => {
  const body = formatCommentBody(finding, { commitSha: 'abc1234567' });
  assert.match(body, /HIGH/);
  assert.match(body, /abc1234/);
  assert.match(body, /Null pointer on missing config\./);
});

test('formatCommentBody includes the suggestion when present', () => {
  const body = formatCommentBody(finding, { commitSha: 'abc1234567' });
  assert.match(body, /Suggested fix/);
  assert.match(body, /Add a guard before dereferencing config\.db\./);
});

test('formatCommentBody omits the suggestion block when absent', () => {
  const body = formatCommentBody({ ...finding, suggestion: '' }, { commitSha: 'abc1234567' });
  assert.doesNotMatch(body, /Suggested fix/);
});

test('formatSummaryBody reports the finding count when nonzero', () => {
  const body = formatSummaryBody([finding], { commitSha: 'abc1234567' });
  assert.match(body, /1 inline comment/);
  assert.match(body, /abc1234/);
});

test('formatSummaryBody reports no issues when empty', () => {
  const body = formatSummaryBody([], { commitSha: 'abc1234567' });
  assert.match(body, /found no issues/);
});
