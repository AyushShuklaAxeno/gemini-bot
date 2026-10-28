export class GroqApiError extends Error {}

const API_BASE = 'https://api.groq.com/openai/v1/chat/completions';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call the Groq REST API (chat/completions) and return the raw model text.
 * Auth is the GROQ_API_KEY sent in the Authorization: Bearer header.
 * Uses JSON object mode to guarantee valid JSON responses.
 * Retries on 429/5xx (rate limits and transient server errors).
 */
export async function runGroq(
  prompt,
  {
    apiKey,
    model = 'llama-3.3-70b-versatile',
    fetchFn = fetch,
    timeoutMs = 120_000,
    maxRetries = 3,
    sleepFn = defaultSleep,
  } = {},
) {
  if (!apiKey) throw new GroqApiError('GROQ_API_KEY is missing');

  const body = JSON.stringify({
    model,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) await sleepFn(2000 * 2 ** (attempt - 1));

    let res;
    try {
      res = await fetchFn(API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastError = new GroqApiError(`Groq request failed: ${err.message}`);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      let errorMsg = text.slice(0, 500);
      try {
        const json = JSON.parse(text);
        if (json.error?.message) errorMsg = json.error.message;
      } catch {}
      lastError = new GroqApiError(`Groq API error ${res.status}: ${errorMsg}`);
      if (RETRYABLE_STATUS.has(res.status)) continue;
      throw lastError;
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const text = choice?.message?.content;
    if (!text || !text.trim()) {
      throw new GroqApiError(
        `Groq returned no text (finish_reason: ${choice?.finish_reason ?? 'unknown'})`,
      );
    }
    if (choice.finish_reason === 'length') {
      throw new GroqApiError('Groq output was cut off (length limit reached); JSON would be incomplete');
    }
    return text;
  }
  throw lastError;
}

// Backwards compatibility aliases
export const runGemini = runGroq;
export const GeminiApiError = GroqApiError;
