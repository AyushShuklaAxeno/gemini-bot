export class GeminiApiError extends Error {}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Forces Gemini to return a JSON array of findings in exactly the shape
// parseFindings.mjs expects, so we don't depend on it obeying "no preamble".
const FINDINGS_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      file: { type: 'STRING' },
      line: { type: 'INTEGER' },
      severity: { type: 'STRING', enum: ['high', 'medium', 'low'] },
      summary: { type: 'STRING' },
      suggestion: { type: 'STRING' },
    },
    required: ['file', 'line', 'severity', 'summary'],
  },
};

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call the Gemini REST API (generateContent) and return the raw model text.
 * Auth is the GEMINI_API_KEY sent in the x-goog-api-key header. No tools are
 * enabled, so untrusted PR diff content can never trigger any action.
 * Retries on 429/5xx (free-tier keys hit rate limits often).
 */
export async function runGemini(
  prompt,
  {
    apiKey,
    model = 'gemini-2.5-flash',
    fetchFn = fetch,
    timeoutMs = 120_000,
    maxRetries = 3,
    sleepFn = defaultSleep,
  } = {},
) {
  if (!apiKey) throw new GeminiApiError('GEMINI_API_KEY is missing');

  const url = `${API_BASE}/${encodeURIComponent(model)}:generateContent`;
  const body = JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema: FINDINGS_SCHEMA,
    },
  });

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleepFn(2000 * 2 ** (attempt - 1));

    let res;
    try {
      res = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = new GeminiApiError(`Gemini request failed: ${err.message}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      lastError = new GeminiApiError(`Gemini API error ${res.status}: ${text.slice(0, 500)}`);
      if (RETRYABLE_STATUS.has(res.status)) continue;
      throw lastError;
    }

    const data = await res.json();
    if (data.promptFeedback?.blockReason) {
      throw new GeminiApiError(`Gemini blocked the prompt: ${data.promptFeedback.blockReason}`);
    }
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!text.trim()) {
      throw new GeminiApiError(
        `Gemini returned no text (finishReason: ${candidate?.finishReason ?? 'unknown'})`,
      );
    }
    if (candidate.finishReason === 'MAX_TOKENS') {
      throw new GeminiApiError('Gemini output was cut off (MAX_TOKENS); JSON would be incomplete');
    }
    return text;
  }
  throw lastError;
}
