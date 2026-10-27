import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postBitbucketComment, postAllBitbucketComments } from './postBitbucket.mjs';

test('POSTs a single comment to the pullrequests/:id/comments endpoint', async () => {
  let seenUrl;
  let seenOptions;
  const fetchFn = async (url, options) => {
    seenUrl = url;
    seenOptions = options;
    return { ok: true, status: 200, json: async () => ({ id: 1 }) };
  };
  const payload = { content: { raw: 'hi' } };
  await postBitbucketComment({
    workspace: 'axeno-india',
    repoSlug: 'bstdc',
    prId: 7,
    token: 'bb-token',
    payload,
    fetchFn,
  });

  assert.equal(
    seenUrl,
    'https://api.bitbucket.org/2.0/repositories/axeno-india/bstdc/pullrequests/7/comments',
  );
  assert.equal(seenOptions.headers.Authorization, 'Bearer bb-token');
  assert.deepEqual(JSON.parse(seenOptions.body), payload);
});

test('throws with status and body text on a non-ok response', async () => {
  const fetchFn = async () => ({ ok: false, status: 400, text: async () => 'bad request' });
  await assert.rejects(
    () =>
      postBitbucketComment({
        workspace: 'w',
        repoSlug: 'r',
        prId: 1,
        token: 't',
        payload: {},
        fetchFn,
      }),
    /400.*bad request/s,
  );
});

test('posts multiple comments sequentially, in order', async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    calls.push(JSON.parse(options.body));
    return { ok: true, status: 200, json: async () => ({}) };
  };
  const comments = [{ content: { raw: 'first' } }, { content: { raw: 'second' } }];
  await postAllBitbucketComments({
    workspace: 'w',
    repoSlug: 'r',
    prId: 1,
    token: 't',
    comments,
    fetchFn,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].content.raw, 'first');
  assert.equal(calls[1].content.raw, 'second');
});

test('isolates a failed comment so the rest of the batch still posts', async () => {
  const calls = [];
  const fetchFn = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push(body.content.raw);
    if (body.content.raw === 'second') {
      return { ok: false, status: 400, text: async () => 'bad line number' };
    }
    return { ok: true, status: 200, json: async () => ({ id: calls.length }) };
  };
  const comments = [
    { content: { raw: 'first' } },
    { content: { raw: 'second' } },
    { content: { raw: 'third' } },
  ];
  const results = await postAllBitbucketComments({
    workspace: 'w',
    repoSlug: 'r',
    prId: 1,
    token: 't',
    comments,
    fetchFn,
  });

  // All three fetchFn calls happened - the loop didn't stop on failure.
  assert.deepEqual(calls, ['first', 'second', 'third']);

  assert.equal(results.length, 3);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.match(results[1].error, /400.*bad line number/s);
  assert.equal(results[2].ok, true);
});
