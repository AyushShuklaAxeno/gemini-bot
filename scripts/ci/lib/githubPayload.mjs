import { formatCommentBody, formatSummaryBody } from './formatComment.mjs';

export function buildGithubReviewPayload(findings, { commitSha }) {
  return {
    commit_id: commitSha,
    event: 'COMMENT',
    body: formatSummaryBody(findings, { commitSha }),
    comments: findings.map((f) => ({
      path: f.file,
      line: f.line,
      side: 'RIGHT',
      body: formatCommentBody(f, { commitSha }),
    })),
  };
}
