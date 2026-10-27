#!/usr/bin/env node
// scripts/ci/review.mjs
//
// Entry point invoked identically by the GitHub Actions workflow and the
// Bitbucket Pipelines step. Never exits nonzero for a review-side problem
// (bad env, empty diff, unparsable Gemini output, network error) — only a
// genuine bug in this file itself should ever surface as a failing step,
// and even that is caught below and swallowed so it can't block a merge.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, EnvError } from './lib/env.mjs';
import { excludePathspecs } from './lib/filterDiff.mjs';
import { truncateText } from './lib/truncate.mjs';
import { getDiff } from './lib/git.mjs';
import { extractInvariantsSection } from './lib/claudeMdExcerpt.mjs';
import { buildPrompt } from './lib/prompt.mjs';
import { runGemini, GeminiApiError } from './lib/geminiApi.mjs';
import { annotateDiff, filterFindingsToDiff } from './lib/diffLines.mjs';
import { parseFindings, FindingsParseError } from './lib/parseFindings.mjs';
import { buildGithubReviewPayload } from './lib/githubPayload.mjs';
import { buildBitbucketCommentPayload, buildBitbucketSummaryPayload } from './lib/bitbucketPayload.mjs';
import { postGithubReview } from './lib/postGithub.mjs';
import { postBitbucketComment, postAllBitbucketComments } from './lib/postBitbucket.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOT_ROOT = path.resolve(__dirname, '..', '..');
const REPO_ROOT = process.env.GITHUB_WORKSPACE || process.env.BITBUCKET_CLONE_DIR || BOT_ROOT;

const PROMPT_PATH = existsSync(path.join(REPO_ROOT, '.claude', 'ci-review-prompt.md'))
  ? path.join(REPO_ROOT, '.claude', 'ci-review-prompt.md')
  : path.join(BOT_ROOT, '.claude', 'ci-review-prompt.md');

const CLAUDE_MD_PATH = path.join(REPO_ROOT, 'CLAUDE.md');

// Keeps a single review run to roughly 15-20k input tokens for the diff itself.
// See the comment in claudeMdExcerpt.mjs.
const MAX_DIFF_BYTES = 40_000;
// Comfortably covers the real "Critical backend invariants" section
// (measured at 293,201 bytes) with room for growth, while still keeping
// a hard ceiling as a safety net. Gemini's context window is large, but
// free-tier keys have a tokens-per-minute limit; lower this if you hit 429s.
const MAX_CLAUDE_MD_BYTES = 350_000;

async function main() {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof EnvError) {
      console.error(`[review] config error: ${err.message}`);
      return;
    }
    throw err;
  }

  const rawDiff = getDiff({
    base: config.base,
    head: config.head,
    excludePathspecs: excludePathspecs(),
    cwd: REPO_ROOT,
  });

  if (!rawDiff.trim()) {
    console.log('[review] no reviewable changes in diff, skipping');
    return;
  }

  // Prefix every new-side line with its real line number so Gemini can cite
  // exact lines, and remember which lines are valid targets for inline comments.
  const { annotated, validLines } = annotateDiff(rawDiff);

   console.log(`[review] diff covers ${validLines.size} file(s), ${rawDiff.length} bytes`);
  const { text: diff, truncated } = truncateText(annotated, MAX_DIFF_BYTES, {
    notice: `\n\n[... diff truncated at ${MAX_DIFF_BYTES} bytes; review may be incomplete ...]`,
  });

  const instructions = existsSync(PROMPT_PATH) ? readFileSync(PROMPT_PATH, 'utf8') : '';
  const claudeMdRaw = existsSync(CLAUDE_MD_PATH) ? readFileSync(CLAUDE_MD_PATH, 'utf8') : '';
  const invariantsSection = claudeMdRaw ? extractInvariantsSection(claudeMdRaw) : '';

  let customRulesContent = '';
  if (process.env.CUSTOM_RULES_FILE) {
    const customRulesPath = path.isAbsolute(process.env.CUSTOM_RULES_FILE)
      ? process.env.CUSTOM_RULES_FILE
      : path.join(REPO_ROOT, process.env.CUSTOM_RULES_FILE);
    if (existsSync(customRulesPath)) {
      customRulesContent = readFileSync(customRulesPath, 'utf8');
    }
  }

  const combinedRules = [invariantsSection, customRulesContent].filter(Boolean).join('\n\n');
  const { text: claudeMdExcerpt } = truncateText(combinedRules, MAX_CLAUDE_MD_BYTES, {
    notice: '\n\n[... Project conventions excerpt truncated ...]',
  });

  const prompt = buildPrompt({ instructions, claudeMdExcerpt, diff, truncated });

  let findings;
  try {
    const raw = await runGemini(prompt, {
      apiKey: config.geminiApiKey,
      model: config.geminiModel,
    });
     console.log(`[review] gemini response (${raw.length} chars): ${raw.slice(0, 1500)}`);
    findings = parseFindings(raw);
    console.log(`[review] gemini returned ${findings.length} valid finding(s)`);
  } catch (err) {
    if (err instanceof GeminiApiError || err instanceof FindingsParseError) {
      console.error(`[review] ${err.message}`);
      return;
    }
    throw err;
  }

  // GitHub rejects the whole review if any comment targets a line outside the diff.
  const { kept, dropped } = filterFindingsToDiff(findings, validLines);
  if (dropped.length > 0) {
        console.warn(
      `[review] dropped ${dropped.length} finding(s) pointing outside the diff: ` +
        dropped.map((f) => `${f.file}:${f.line}`).join(', '),
    );
  }
  findings = kept;

  console.log(`[review] ${findings.length} finding(s) to post`);

  if (config.provider === 'github') {
    const payload = buildGithubReviewPayload(findings, { commitSha: config.head });
    await postGithubReview({
      owner: config.github.owner,
      repo: config.github.repo,
      prNumber: config.github.prNumber,
      token: config.github.token,
      payload,
    });
  } else {
    const summaryPayload = buildBitbucketSummaryPayload(findings, { commitSha: config.head });
    await postBitbucketComment({
      workspace: config.bitbucket.workspace,
      repoSlug: config.bitbucket.repoSlug,
      prId: config.bitbucket.prId,
      token: config.bitbucket.token,
      payload: summaryPayload,
    });

    const commentPayloads = findings.map((f) =>
      buildBitbucketCommentPayload(f, { commitSha: config.head }),
    );
    const postResults = await postAllBitbucketComments({
      workspace: config.bitbucket.workspace,
      repoSlug: config.bitbucket.repoSlug,
      prId: config.bitbucket.prId,
      token: config.bitbucket.token,
      comments: commentPayloads,
    });
    const failedCount = postResults.filter((r) => !r.ok).length;
    if (failedCount > 0) {
      console.error(`[review] ${failedCount} of ${postResults.length} Bitbucket comment(s) failed to post`);
    }
  }

  console.log('[review] done');
}

main().catch((err) => {
  console.error(`[review] unexpected error: ${err.stack || err.message}`);
  // Never fail the CI job because of the review step.
  process.exitCode = 0;
});