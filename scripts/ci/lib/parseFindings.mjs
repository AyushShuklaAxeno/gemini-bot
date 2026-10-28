export class FindingsParseError extends Error {}

const VALID_SEVERITIES = new Set(['high', 'medium', 'low']);

function extractJson(raw) {
  let text = raw.trim();

  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) text = fenceMatch[1].trim();

  try {
    return JSON.parse(text);
  } catch {
    const arrStart = text.indexOf('[');
    const arrEnd = text.lastIndexOf(']');
    const objStart = text.indexOf('{');
    const objEnd = text.lastIndexOf('}');

    const tryArrayFirst = arrStart !== -1 && (objStart === -1 || arrStart < objStart);

    if (tryArrayFirst) {
      if (arrStart !== -1 && arrEnd > arrStart) {
        try {
          return JSON.parse(text.slice(arrStart, arrEnd + 1));
        } catch {}
      }
      if (objStart !== -1 && objEnd > objStart) {
        try {
          return JSON.parse(text.slice(objStart, objEnd + 1));
        } catch {}
      }
    } else {
      if (objStart !== -1 && objEnd > objStart) {
        try {
          return JSON.parse(text.slice(objStart, objEnd + 1));
        } catch {}
      }
      if (arrStart !== -1 && arrEnd > arrStart) {
        try {
          return JSON.parse(text.slice(arrStart, arrEnd + 1));
        } catch {}
      }
    }

    throw new FindingsParseError(
      `No JSON found in model output: ${raw.slice(0, 200)}`,
    );
  }
}

export function parseFindings(rawOutput, { maxFindings = 25 } = {}) {
  let parsed;
  try {
    parsed = extractJson(rawOutput);
  } catch (err) {
    if (err instanceof FindingsParseError) throw err;
    throw new FindingsParseError(`Could not parse findings JSON: ${err.message}`);
  }

  if (!Array.isArray(parsed)) {
    if (parsed && typeof parsed === 'object') {
      const candidates = [parsed.findings, parsed.issues, parsed.reviews, parsed.comments];
      const foundArray = candidates.find(Array.isArray) ?? Object.values(parsed).find(Array.isArray);
      if (Array.isArray(foundArray)) {
        parsed = foundArray;
      } else {
        throw new FindingsParseError('Findings JSON is not an array');
      }
    } else {
      throw new FindingsParseError('Findings JSON is not an array');
    }
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
