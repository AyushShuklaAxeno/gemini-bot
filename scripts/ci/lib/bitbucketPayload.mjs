import { formatCommentBody, formatSummaryBody } from './formatComment.mjs';

export function buildBitbucketCommentPayload(finding, { commitSha }) {
  return {
    content: { raw: formatCommentBody(finding, { commitSha }) },
    inline: { to: finding.line, path: finding.file },
  };
}

export function buildBitbucketSummaryPayload(findings, { commitSha }) {
  return {
    content: { raw: formatSummaryBody(findings, { commitSha }) },
  };
}
