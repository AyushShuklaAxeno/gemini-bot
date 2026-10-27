export async function postBitbucketComment({ workspace, repoSlug, prId, token, payload, fetchFn = fetch }) {
  const url = `https://api.bitbucket.org/2.0/repositories/${workspace}/${repoSlug}/pullrequests/${prId}/comments`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bitbucket comment post failed (${res.status}): ${text}`);
  }
  return res.json();
}

/** Posts sequentially (not Promise.all) to stay under Bitbucket's per-second rate limit. */
export async function postAllBitbucketComments({ workspace, repoSlug, prId, token, comments, fetchFn = fetch }) {
  const results = [];
  for (const payload of comments) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await postBitbucketComment({ workspace, repoSlug, prId, token, payload, fetchFn });
      results.push({ ok: true, result });
    } catch (err) {
      results.push({ ok: false, error: err.message });
    }
  }
  return results;
}
