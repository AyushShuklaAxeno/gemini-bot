export async function postGithubReview({ owner, repo, prNumber, token, payload, fetchFn = fetch }) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/reviews`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub review post failed (${res.status}): ${text}`);
  }
  return res.json();
}
