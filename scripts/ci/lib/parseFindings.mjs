export class FindingsParseError extends Error {}

const VALID_SEVERITIES = new Set(['high', 'medium', 'low']);

function extractJsonArray(raw) {
  let text = raw.trim();

  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) {
      throw new FindingsParseError(
        `No JSON array found in Gemini output: ${raw.slice(0, 200)}`,
      );
    }
    return JSON.parse(text.slice(start, end + 1));
  }
}

export function parseFindings(rawOutput, { maxFindings = 25 } = {}) {
  let parsed;
  try {
    parsed = extractJsonArray(rawOutput);
  } catch (err) {
    if (err instanceof FindingsParseError) throw err;
    throw new FindingsParseError(`Could not parse findings JSON: ${err.message}`);
  }
  if (!Array.isArray(parsed)) {
    throw new FindingsParseError('Findings JSON is not an array');
  }

  const findings = [];
  for (const item of parsed) {
    const isValid =
      item &&
      typeof item === 'object' &&
      typeof item.file === 'string' &&
      item.file.trim() &&
      Number.isInteger(item.line) &&
      item.line > 0 &&
      typeof item.summary === 'string' &&
      item.summary.trim();

    if (isValid) {
      findings.push({
        file: item.file.trim(),
        line: item.line,
        severity: VALID_SEVERITIES.has(item.severity) ? item.severity : 'medium',
        summary: item.summary.trim(),
        suggestion: typeof item.suggestion === 'string' ? item.suggestion.trim() : '',
      });
    }
    if (findings.length >= maxFindings) break;
  }
  return findings;
}
