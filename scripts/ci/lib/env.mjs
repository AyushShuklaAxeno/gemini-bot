export class EnvError extends Error {}

function required(env, key) {
  const value = env[key];
  if (!value) throw new EnvError(`Missing required env var: ${key}`);
  return value;
}

export function loadConfig(env = process.env) {
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
