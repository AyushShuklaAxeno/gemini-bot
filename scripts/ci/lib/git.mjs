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
  });
}
