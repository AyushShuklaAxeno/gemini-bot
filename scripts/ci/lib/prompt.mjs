export function buildPrompt({ instructions, claudeMdExcerpt, diff, truncated }) {
  const parts = [
    instructions.trim(),
    '',
    '## Project conventions to check against (excerpt of CLAUDE.md)',
    '',
    claudeMdExcerpt.trim(),
    '',
    '## Diff to review',
    '',
  ];
  if (truncated) {
    parts.push('NOTE: this diff was truncated to fit a size limit; review what is shown.', '');
  }
  parts.push('```diff', diff, '```');
  return parts.join('\n');
}
