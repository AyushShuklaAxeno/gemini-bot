import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getDiff } from './git.mjs';

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'ignore' });
}

function makeTempRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ci-review-git-test-'));
  run('git', ['init', '-q'], dir);
  run('git', ['config', 'user.email', 'test@example.com'], dir);
  run('git', ['config', 'user.name', 'Test'], dir);
  return dir;
}

test('returns a diff between two commits, excluding pathspecs', () => {
  const dir = makeTempRepo();
  try {
    writeFileSync(path.join(dir, 'app.js'), 'console.log("v1");\n');
    writeFileSync(path.join(dir, 'package-lock.json'), '{"v":1}\n');
    run('git', ['add', '.'], dir);
    run('git', ['commit', '-q', '-m', 'base'], dir);
    const base = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

    writeFileSync(path.join(dir, 'app.js'), 'console.log("v2");\n');
    writeFileSync(path.join(dir, 'package-lock.json'), '{"v":2}\n');
    run('git', ['add', '.'], dir);
    run('git', ['commit', '-q', '-m', 'head'], dir);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

    const diff = getDiff({
      base,
      head,
      excludePathspecs: [':(exclude)package-lock.json'],
      cwd: dir,
    });

    assert.match(diff, /app\.js/);
    assert.match(diff, /v2/);
    assert.doesNotMatch(diff, /package-lock\.json/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('returns an empty string when there are no changes', () => {
  const dir = makeTempRepo();
  try {
    writeFileSync(path.join(dir, 'app.js'), 'console.log("v1");\n');
    run('git', ['add', '.'], dir);
    run('git', ['commit', '-q', '-m', 'base'], dir);
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();

    const diff = getDiff({ base: sha, head: sha, cwd: dir });
    assert.equal(diff.trim(), '');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
