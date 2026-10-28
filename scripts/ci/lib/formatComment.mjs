const SEVERITY_EMOJI = { high: '🔴', medium: '🟠', low: '🟡' };

export function formatCommentBody(finding, { commitSha }) {
  const emoji = SEVERITY_EMOJI[finding.severity] ?? '🟠';
  const lines = [
    `${emoji} **${finding.severity.toUpperCase()}** — AI review @ \`${commitSha.slice(0, 7)}\``,
    '',
    finding.summary,
  ];
  if (finding.suggestion) {
    lines.push('', '**Suggested fix:**', finding.suggestion);
  }
  return lines.join('\n');
}

export function formatSummaryBody(findings, { commitSha }) {
  const shortSha = commitSha.slice(0, 7);
  if (findings.length === 0) {
    return `AI reviewed this PR (commit \`${shortSha}\`) and found no issues to flag.`;
  }
  return `AI reviewed this PR (commit \`${shortSha}\`) and left ${findings.length} inline comment(s).`;
}
