import { test } from 'node:test';
import assert from 'node:assert/strict';
import { postGithubReview } from './postGithub.mjs';

function okFetch(responseBody) {
  return async (url, options) => ({
    ok: true,
    status: 200,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
    _url: url,
    _options: options,
  });
}

test('POSTs to the pulls/:pr/reviews endpoint with auth + payload', async () => {
  let seenUrl;
  let seenOptions;
  const fetchFn = async (url, options) => {
    seenUrl = url;
    seenOptions = options;
    return { ok: true, status: 200, json: async () => ({ id: 1 }) };
  };
  const payload = { commit_id: 'abc', event: 'COMMENT', comments: [] };
  const result = await postGithubReview({
    owner: 'axeno-india',
    repo: 'bstdc',
    prNumber: 42,
    token: 'gh-token',
    payload,
    fetchFn,
  });

  assert.equal(seenUrl, 'https://api.github.com/repos/axeno-india/bstdc/pulls/42/reviews');
  assert.equal(seenOptions.method, 'POST');
  assert.equal(seenOptions.headers.Authorization, 'Bearer gh-token');
  assert.deepEqual(JSON.parse(seenOptions.body), payload);
  assert.deepEqual(result, { id: 1 });
});

test('throws with status and body text on a non-ok response', async () => {
  const fetchFn = async () => ({ ok: false, status: 422, text: async () => 'nope' });
  await assert.rejects(
    () =>
      postGithubReview({
        owner: 'o',
        repo: 'r',
        prNumber: 1,
        token: 't',
        payload: {},
        fetchFn,
      }),
    /422.*nope/s,
  );
});
