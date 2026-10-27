import { readFileSync } from 'node:fs';

export class EnvError extends Error {}

// Docker actions can't use the `github` context in action.yml's runs.env, so
// the PR number and SHAs are read from the event payload the runner mounts
// at GITHUB_EVENT_PATH. Explicit CI_* env vars still take priority.
function withGithubEventFallback(env, readFn) {
  if (env.CI_PR_NUMBER && env.CI_BASE_SHA && env.CI_HEAD_SHA) return env;
  if (!env.GITHUB_EVENT_PATH) return env;
  try {
    const pr = JSON.parse(readFn(env.GITHUB_EVENT_PATH, 'utf8')).pull_request;
    const fallback = {
      CI_PR_NUMBER: pr?.number != null ? String(pr.number) : '',
      CI_BASE_SHA: pr?.base?.sha ?? '',
      CI_HEAD_SHA: pr?.head?.sha ?? '',
    };
    const merged = { ...env };
    for (const [k, v] of Object.entries(fallback)) if (!merged[k]) merged[k] = v;
    return merged;
  } catch {
    return env;
  }
}

function required(env, key) {
  const value = env[key];
  if (!value) throw new EnvError(`Missing required env var: ${key}`);
  return value;
}

export function loadConfig(rawEnv = process.env, { readFileFn = readFileSync } = {}) {
  const env = rawEnv.CI_PROVIDER === 'github' ? withGithubEventFallback(rawEnv, readFileFn) : rawEnv;
  const provider = required(env, 'CI_PROVIDER');
  if (provider !== 'github' && provider !== 'bitbucket') {
    throw new EnvError(`CI_PROVIDER must be "github" or "bitbucket", got: ${provider}`);
  }

  const shared = {
    provider,
    geminiApiKey: required(env, 'GEMINI_API_KEY'),
    geminiModel: env.GEMINI_MODEL || 'gemini-2.5-flash',
    base: required(env, 'CI_BASE_SHA'),
    head: required(env, 'CI_HEAD_SHA'),
  };

  if (provider === 'github') {
    return {
      ...shared,
      github: {
        token: required(env, 'GITHUB_TOKEN'),
        owner: required(env, 'GITHUB_REPOSITORY_OWNER'),
        repo: required(env, 'GITHUB_REPOSITORY').split('/')[1],
        prNumber: required(env, 'CI_PR_NUMBER'),
      },
    };
  }

  return {
    ...shared,
    bitbucket: {
      token: required(env, 'BITBUCKET_ACCESS_TOKEN'),
      workspace: required(env, 'BITBUCKET_WORKSPACE'),
      repoSlug: required(env, 'BITBUCKET_REPO_SLUG'),
      prId: required(env, 'BITBUCKET_PR_ID'),
    },
  };
}