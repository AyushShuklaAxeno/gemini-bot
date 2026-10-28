import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, EnvError } from './env.mjs';

const baseGithubEnv = {
  CI_PROVIDER: 'github',
  GROQ_API_KEY: 'groq-key',
  CI_BASE_SHA: 'base-sha',
  CI_HEAD_SHA: 'head-sha',
  GITHUB_TOKEN: 'gh-token',
  GITHUB_REPOSITORY_OWNER: 'axeno-india',
  GITHUB_REPOSITORY: 'axeno-india/bstdc',
  CI_PR_NUMBER: '42',
};

const baseBitbucketEnv = {
  CI_PROVIDER: 'bitbucket',
  GROQ_API_KEY: 'groq-key',
  CI_BASE_SHA: 'origin/develop',
  CI_HEAD_SHA: 'head-sha',
  BITBUCKET_ACCESS_TOKEN: 'bb-token',
  BITBUCKET_WORKSPACE: 'axeno-india',
  BITBUCKET_REPO_SLUG: 'bstdc',
  BITBUCKET_PR_ID: '7',
};

test('loads a valid github config', () => {
  const config = loadConfig(baseGithubEnv);
  assert.equal(config.provider, 'github');
  assert.equal(config.groqApiKey, 'groq-key');
  assert.equal(config.groqModel, 'llama-3.3-70b-versatile');
  assert.equal(config.base, 'base-sha');
  assert.equal(config.head, 'head-sha');
  assert.deepEqual(config.github, {
    token: 'gh-token',
    owner: 'axeno-india',
    repo: 'bstdc',
    prNumber: '42',
  });
});

test('loads a valid bitbucket config', () => {
  const config = loadConfig(baseBitbucketEnv);
  assert.equal(config.provider, 'bitbucket');
  assert.deepEqual(config.bitbucket, {
    token: 'bb-token',
    workspace: 'axeno-india',
    repoSlug: 'bstdc',
    prId: '7',
  });
});

test('supports legacy GEMINI_API_KEY as fallback', () => {
  const env = { ...baseGithubEnv };
  delete env.GROQ_API_KEY;
  env.GEMINI_API_KEY = 'legacy-key';
  const config = loadConfig(env);
  assert.equal(config.groqApiKey, 'legacy-key');
});

test('throws EnvError naming a missing shared var', () => {
  const env = { ...baseGithubEnv };
  delete env.GROQ_API_KEY;
  assert.throws(() => loadConfig(env), (err) => {
    assert.ok(err instanceof EnvError);
    assert.match(err.message, /GROQ_API_KEY/);
    return true;
  });
});

test('throws EnvError naming a missing github-specific var', () => {
  const env = { ...baseGithubEnv };
  delete env.GITHUB_REPOSITORY;
  assert.throws(() => loadConfig(env), /GITHUB_REPOSITORY/);
});

test('throws EnvError naming a missing bitbucket-specific var', () => {
  const env = { ...baseBitbucketEnv };
  delete env.BITBUCKET_ACCESS_TOKEN;
  assert.throws(() => loadConfig(env), /BITBUCKET_ACCESS_TOKEN/);
});

test('throws EnvError for an invalid CI_PROVIDER', () => {
  const env = { ...baseGithubEnv, CI_PROVIDER: 'gitlab' };
  assert.throws(() => loadConfig(env), /CI_PROVIDER/);
});

test('github: falls back to the PR event file when CI_* vars are not set', () => {
  const env = { ...baseGithubEnv, GITHUB_EVENT_PATH: '/github/workflow/event.json' };
  delete env.CI_PR_NUMBER;
  delete env.CI_BASE_SHA;
  delete env.CI_HEAD_SHA;
  const readFileFn = () =>
    JSON.stringify({ pull_request: { number: 7, base: { sha: 'b1' }, head: { sha: 'h1' } } });
  const config = loadConfig(env, { readFileFn });
  assert.equal(config.github.prNumber, '7');
  assert.equal(config.base, 'b1');
  assert.equal(config.head, 'h1');
});

test('github: still errors clearly when neither CI_* vars nor an event file exist', () => {
  const env = { ...baseGithubEnv };
  delete env.CI_PR_NUMBER;
  assert.throws(() => loadConfig(env), /CI_PR_NUMBER/);
});
