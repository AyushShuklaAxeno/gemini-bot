function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  };
}

/**
 * Post a PR review with inline comments.
 * If GitHub rejects the batch with 422 (usually because one comment targets a
 * line it doesn't consider part of the diff), fall back to: a summary-only
 * review, then each inline comment on its own, so one bad comment can't
 * wipe out all the others.
 */
export async function postGithubReview({ owner, repo, prNumber, token, payload, fetchFn = fetch }) {
  const base = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`;
  const headers = githubHeaders(token);

  const res = await fetchFn(`${base}/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (res.ok) return res.json();

  const text = await res.text();
  if (res.status !== 422 || !payload.comments || payload.comments.length === 0) {
    throw new Error(`GitHub review post failed (${res.status}): ${text}`);
  }

  console.warn(`[review] batch review rejected (422): ${text.slice(0, 300)}`);
  console.warn('[review] falling back to posting inline comments one by one');

  const summaryRes = await fetchFn(`${base}/reviews`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ commit_id: payload.commit_id, event: 'COMMENT', body: payload.body }),
  });
  if (!summaryRes.ok) {
    throw new Error(`GitHub summary review failed (${summaryRes.status}): ${await summaryRes.text()}`);
  }

  let posted = 0;
  let failed = 0;
  for (const c of payload.comments) {
    const r = await fetchFn(`${base}/comments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        body: c.body,
        commit_id: payload.commit_id,
        path: c.path,
        line: c.line,
        side: c.side || 'RIGHT',
      }),
    });
    if (r.ok) {
      posted++;
    } else {
      failed++;
      console.error(`[review] inline comment on ${c.path}:${c.line} failed (${r.status}): ${(await r.text()).slice(0, 300)}`);
    }
  }
  console.log(`[review] fallback finished: ${posted} inline comment(s) posted, ${failed} failed`);
  return { fallback: true, posted, failed };
}