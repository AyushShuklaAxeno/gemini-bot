// Re-export from openrouterApi for backwards compatibility
export {
  runOpenRouter as runGroq,
  OpenRouterApiError as GroqApiError,
  runOpenRouter as runGemini,
  OpenRouterApiError as GeminiApiError,
  runOpenRouter,
  OpenRouterApiError,
} from './openrouterApi.mjs';
