import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runOpenRouter, OpenRouterApiError } from './openrouterApi.mjs';

const ok = (content, finish_reason = 'stop') => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content }, finish_reason }] }),
});
const fail = (status, body = 'err') => ({
  ok: false,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});
const noSleep = async () => {};

test('posts to OpenRouter chat completions with auth header, model, and json_object response format', async () => {
  let url, opts;
  const fetchFn = async (u, o) => { url = u; opts = o; return ok('{"findings":[]}'); };
  const out = await runOpenRouter('hello', { apiKey: 'sk-or-v1-test123', model: 'anthropic/claude-3.5-sonnet', fetchFn });
  assert.equal(out, '{"findings":[]}');
  assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(opts.headers['Authorization'], 'Bearer sk-or-v1-test123');
  assert.equal(opts.headers['Content-Type'], 'application/json');
  assert.equal(opts.headers['HTTP-Referer'], 'https://github.com/ai-code-review-bot');
  const body = JSON.parse(opts.body);
  assert.equal(body.model, 'anthropic/claude-3.5-sonnet');
  assert.ok(Array.isArray(body.models));
  assert.equal(body.messages[0].role, 'user');
  assert.equal(body.messages[0].content, 'hello');
  assert.deepEqual(body.response_format, { type: 'json_object' });
});

test('falls back to alternative active model when requested model returns 404', async () => {
  const triedModels = [];
  const fetchFn = async (u, o) => {
    const body = JSON.parse(o.body);
    triedModels.push(body.model);
    if (body.model === 'invalid/model-id') {
      return fail(404, { error: { message: 'The model does not exist' } });
    }
    return ok('{"findings":[]}');
  };

  const out = await runOpenRouter('hello', {
    apiKey: 'sk-or-v1-test123',
    model: 'invalid/model-id',
    fallbackModels: ['deepseek/deepseek-chat'],
    fetchFn,
    sleepFn: noSleep,
  });

  assert.equal(out, '{"findings":[]}');
  assert.deepEqual(triedModels, ['invalid/model-id', 'deepseek/deepseek-chat']);
});

test('throws when api key missing', async () => {
  await assert.rejects(() => runOpenRouter('p', {}), OpenRouterApiError);
});

test('retries on 429 then succeeds', async () => {
  let calls = 0;
  const fetchFn = async () => (++calls < 3 ? fail(429) : ok('{"findings":[]}'));
  const out = await runOpenRouter('p', { apiKey: 'k', fetchFn, sleepFn: noSleep });
  assert.equal(out, '{"findings":[]}');
  assert.equal(calls, 3);
});

test('does not retry on 400', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return fail(400, { error: { message: 'bad key' } }); };
  await assert.rejects(() => runOpenRouter('p', { apiKey: 'k', fetchFn, sleepFn: noSleep }), /400.*bad key/);
  assert.equal(calls, 1);
});

test('gives up after maxRetries on persistent 503', async () => {
  let calls = 0;
  const fetchFn = async () => { calls++; return fail(503); };
  await assert.rejects(() => runOpenRouter('p', { apiKey: 'k', fetchFn, sleepFn: noSleep, maxRetries: 2 }), /503/);
  assert.equal(calls, 3);
});

test('throws on empty output and length finish_reason', async () => {
  const empty = async () => ok('');
  await assert.rejects(() => runOpenRouter('p', { apiKey: 'k', fetchFn: empty }), /no text/);
  const cut = async () => ok('{"findings":[{"file"', 'length');
  await assert.rejects(() => runOpenRouter('p', { apiKey: 'k', fetchFn: cut }), /length/);
});
