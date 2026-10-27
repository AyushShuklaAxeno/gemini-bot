import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGemini, GeminiApiError } from './geminiApi.mjs';

const ok = (text, finishReason = 'STOP') => ({
  ok: true,
  status: 200,
  json: async () => ({ candidates: [{ content: { parts: [{ text }] }, finishReason }] }),
});
const fail = (status, body = 'err') => ({ ok: false, status, text: async () => body });
const noSleep = async () => {};

test('posts to generateContent with api key header and JSON response config', async () => {
  let url, opts;
  const fetchFn = async (u, o) => { url = u; opts = o; return ok('[]'); };
  const out = await runGemini('hello', { apiKey: 'k', model: 'gemini-2.5-flash', fetchFn });
  assert.equal(out, '[]');
  assert.match(url, /models\/gemini-2\.5-flash:generateContent$/);
  assert.equal(opts.headers['x-goog-api-key'], 'k');
  const body = JSON.parse(opts.body);
  assert.equal(body.contents[0].parts[0].text, 'hello');
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.ok(!url.includes('k='), 'key must not be in the URL');
});

test('throws when api key missing', async () => {
  await assert.rejects(() => runGemini('p', {}), GeminiApiError);
});

test('retries on 429 then succeeds', async () => {
  let calls = 0;
  const fetchFn = async () => (++calls < 3 ? fail(429) : ok('[]'));
  const out = await runGemini('p', { apiKey: 'k', fetchFn, sleepFn: noSleep });
  assert.equal(out, '[]');
  assert.equal(calls, 3);
});

test('does not retry on 400', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return fail(400, 'bad key'); };
  await assert.rejects(() => runGemini('p', { apiKey: 'k', fetchFn, sleepFn: noSleep }), /400.*bad key/);
  assert.equal(calls, 1);
});

test('gives up after maxRetries on persistent 503', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return fail(503); };
  await assert.rejects(() => runGemini('p', { apiKey: 'k', fetchFn, sleepFn: noSleep, maxRetries: 2 }), /503/);
  assert.equal(calls, 3);
});

test('throws on blocked prompt, empty output and MAX_TOKENS', async () => {
  const blocked = async () => ({ ok: true, status: 200, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) });
  await assert.rejects(() => runGemini('p', { apiKey: 'k', fetchFn: blocked }), /SAFETY/);
  const empty = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [{ finishReason: 'SAFETY' }] }) });
  await assert.rejects(() => runGemini('p', { apiKey: 'k', fetchFn: empty }), /no text/);
  const cut = async () => ok('[{"file"', 'MAX_TOKENS');
  await assert.rejects(() => runGemini('p', { apiKey: 'k', fetchFn: cut }), /MAX_TOKENS/);
});
