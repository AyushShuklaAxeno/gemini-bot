export class OpenRouterApiError extends Error {}

const API_BASE = 'https://openrouter.ai/api/v1/chat/completions';

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Recommended high-performance code review models on OpenRouter
export const RECOMMENDED_MODELS = [
  'anthropic/claude-3.5-sonnet',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
];

/**
 * Call the OpenRouter REST API (/chat/completions) and return the raw model text.
 * Auth is the OPENROUTER_API_KEY sent in the Authorization: Bearer header.
 * Uses JSON object mode to guarantee valid JSON responses.
 * Retries on 429/5xx with exponential backoff.
 */
export async function runOpenRouter(
  prompt,
  {
    apiKey,
    model = 'anthropic/claude-3.5-sonnet',
    fallbackModels = RECOMMENDED_MODELS.filter((m) => m !== model),
    fetchFn = fetch,
    timeoutMs = 120_000,
    maxRetries = 3,
    sleepFn = defaultSleep,
  } = {},
) {
  if (!apiKey) throw new OpenRouterApiError('OPENROUTER_API_KEY is missing');

  const modelsToTry = [model, ...fallbackModels.filter((m) => m !== model)];
  let lastError;

  for (const currentModel of modelsToTry) {
    let is404 = false;
    const body = JSON.stringify({
      model: currentModel,
      models: [currentModel, ...modelsToTry.filter((m) => m !== currentModel)],
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) await sleepFn(2000 * 2 ** (attempt - 1));

      let res;
      try {
        res = await fetchFn(API_BASE, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://github.com/ai-code-review-bot',
            'X-Title': 'AI Code Review Bot',
          },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        lastError = new OpenRouterApiError(`OpenRouter request failed: ${err.message}`);
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        let errorMsg = text.slice(0, 500);
        try {
          const json = JSON.parse(text);
          if (json.error?.message) errorMsg = json.error.message;
        } catch {}
        lastError = new OpenRouterApiError(`OpenRouter API error ${res.status}: ${errorMsg}`);

        // If the model does not exist or account lacks access (404), fall back
        if (res.status === 404) {
          is404 = true;
          console.warn(`[openrouter] Model "${currentModel}" not available (404), trying fallback...`);
          break;
        }

        if (RETRYABLE_STATUS.has(res.status)) continue;
        throw lastError;
      }

      const data = await res.json();
      const choice = data.choices?.[0];
      const text = choice?.message?.content;
      if (!text || !text.trim()) {
        throw new OpenRouterApiError(
          `OpenRouter returned no text (finish_reason: ${choice?.finish_reason ?? 'unknown'})`,
        );
      }
      if (choice.finish_reason === 'length') {
        throw new OpenRouterApiError('OpenRouter output was cut off (length limit reached); JSON would be incomplete');
      }
      return text;
    }

    if (!is404) {
      throw lastError;
    }
  }

  throw lastError;
}

// Backwards compatibility aliases
export const runGroq = runOpenRouter;
export const GroqApiError = OpenRouterApiError;
export const runGemini = runOpenRouter;
export const GeminiApiError = OpenRouterApiError;
