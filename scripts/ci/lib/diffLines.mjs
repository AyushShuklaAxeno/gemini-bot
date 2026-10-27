// Gemini cannot reliably work out new-file line numbers from raw hunk headers,
// and GitHub rejects the WHOLE review (HTTP 422) if even one inline comment
// points at a line that is not part of the diff. So we (1) prefix every
// new-side line with its real line number before sending the diff to the
// model, and (2) afterwards verify each finding against the real diff.

const HUNK_RE = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

function stripPrefix(p) {
  return p.replace(/^"?(?:[ab]\/)/, '').replace(/^\.\//, '').replace(/"$/, '');
}

/** Returns { annotated, validLines: Map<file, Set<line>> } for a raw unified diff. */
export function annotateDiff(rawDiff) {
  const validLines = new Map();
  const out = [];
  let file = null;
  let inHunk = false;
  let newLine = 0;

  for (const line of rawDiff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      inHunk = false;
      file = null;
      out.push(line);
      continue;
    }
    if (!inHunk) {
      if (line.startsWith('+++ ')) {
        const p = line.slice(4).trim();
        file = p === '/dev/null' ? null : stripPrefix(p);
        if (file && !validLines.has(file)) validLines.set(file, new Set());
      }
      const m = HUNK_RE.exec(line);
      if (m) {
        inHunk = true;
        newLine = Number(m[1]);
      }
      out.push(line);
      continue;
    }

    const m = HUNK_RE.exec(line);
    if (m) {
      newLine = Number(m[1]);
      out.push(line);
      continue;
    }
    const tag = line[0];
    if (tag === '+' || tag === ' ') {
      if (file) validLines.get(file)?.add(newLine);
      out.push(`L${String(newLine).padEnd(5)}| ${line}`);
      newLine++;
    } else if (tag === '-') {
      out.push(`      | ${line}`);
    } else {
      out.push(line); // "\ No newline at end of file" or trailing blank
    }
  }
  return { annotated: out.join('\n'), validLines };
}

function normalizePath(p) {
  return p.trim().replace(/^(?:[ab]\/)/, '').replace(/^\.\//, '');
}

/**
 * Keep only findings that can become a valid GitHub inline comment.
 * A line that is slightly off (within `snapWithin`) is moved to the nearest
 * valid line; anything else is dropped and reported.
 */
export function filterFindingsToDiff(findings, validLines, { snapWithin = 3 } = {}) {
  const kept = [];
  const dropped = [];
  for (const f of findings) {
    const file = normalizePath(f.file);
    const lines = validLines.get(file);
    if (!lines || lines.size === 0) {
      dropped.push(f);
      continue;
    }
    if (lines.has(f.line)) {
      kept.push({ ...f, file });
      continue;
    }
    let best = null;
    for (const l of lines) {
      const d = Math.abs(l - f.line);
      if (d <= snapWithin && (best === null || d < Math.abs(best - f.line))) best = l;
    }
    if (best === null) dropped.push(f);
    else kept.push({ ...f, file, line: best });
  }
  return { kept, dropped };
}