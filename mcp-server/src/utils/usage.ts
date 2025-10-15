import { Provider, ProviderResponse } from '../types.js';

export interface UsageMetrics {
  provider: Provider;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  latencyMs: number;
  timestamp: string;
}

export function extractUsage(
  provider: Provider,
  model: string,
  response: ProviderResponse
): UsageMetrics {
  return {
    provider,
    model,
    prompt_tokens: response.usage.prompt_tokens,
    completion_tokens: response.usage.completion_tokens,
    total_tokens: response.usage.total_tokens,
    latencyMs: response.latencyMs,
    timestamp: new Date().toISOString()
  };
}

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token for English text
  // This is a simplification; actual tokenization varies by model
  return Math.ceil(text.length / 4);
}

export function logUsage(metrics: UsageMetrics, logger: any): void {
  logger.info({
    type: 'usage',
    provider: metrics.provider,
    model: metrics.model,
    tokens: {
      prompt: metrics.prompt_tokens,
      completion: metrics.completion_tokens,
      total: metrics.total_tokens
    },
    latencyMs: metrics.latencyMs,
    timestamp: metrics.timestamp
  });
}
