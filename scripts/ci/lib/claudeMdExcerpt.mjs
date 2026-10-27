const SECTION_START = '## Critical backend invariants';
const SECTION_END = '## Migrations';

/**
 * Pull the "Critical backend invariants" section out of CLAUDE.md — the
 * highest-value part of that (very large) file for spotting a PR that
 * reintroduces something the project deliberately removed or breaks a
 * documented client/server mirror. Falls back to the whole input if the
 * heading text ever changes, so a rename degrades gracefully instead of
 * silently sending nothing.
 *
 * NOTE: The invariants section of CLAUDE.md is large; it will be capped
 * at MAX_CLAUDE_MD_BYTES bytes by the orchestrator (Task 9), so only the
 * earlier portion of the section is checked on any given run. This is a
 * deliberate cost tradeoff (token/time budget), not an oversight.
 */
export function extractInvariantsSection(claudeMdText) {
  const startIdx = claudeMdText.indexOf(SECTION_START);
  if (startIdx === -1) return claudeMdText;
  const endIdx = claudeMdText.indexOf(SECTION_END, startIdx);
  return endIdx === -1 ? claudeMdText.slice(startIdx) : claudeMdText.slice(startIdx, endIdx);
}
