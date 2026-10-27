import { execFileSync } from 'node:child_process';

/**
 * Raw `git diff base...head` output, excluding the given pathspecs.
 * Both `base` and `head` may be SHAs or refs (e.g. `origin/develop`);
 * the caller is responsible for making sure they're fetched/reachable.
 */
export function getDiff({ base, head, excludePathspecs = [], cwd = process.cwd() }) {
  const args = ['diff', `${base}...${head}`, '--', '.', ...excludePathspecs];
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    // GitHub overrides HOME inside Docker actions, so a global
    // `safe.directory` set at image-build time is never read, and git then
    // treats the mounted, differently-owned workspace as "not a git
    // repository". Passing it through the environment always works.
    env: {
      ...process.env,
      GIT_CONFIG_COUNT: '1',
      GIT_CONFIG_KEY_0: 'safe.directory',
      GIT_CONFIG_VALUE_0: '*',
    },
  });
}