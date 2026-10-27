import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBitbucketCommentPayload,
  buildBitbucketSummaryPayload,
} from './bitbucketPayload.mjs';

const finding = { file: 'a.js', line: 5, severity: 'high', summary: 'Bug', suggestion: 'Fix' };

test('builds an inline comment payload anchored to the file and line', () => {
  const payload = buildBitbucketCommentPayload(finding, { commitSha: 'deadbeef' });
  assert.equal(payload.inline.path, 'a.js');
  assert.equal(payload.inline.to, 5);
  assert.match(payload.content.raw, /Bug/);
});

test('builds a summary payload with no inline anchor', () => {
  const payload = buildBitbucketSummaryPayload([finding], { commitSha: 'deadbeef' });
  assert.equal(payload.inline, undefined);
  assert.match(payload.content.raw, /1 inline comment/);
});
