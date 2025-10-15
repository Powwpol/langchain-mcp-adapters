import { Usage } from '../types.js';

type Price = { inputPer1K: number; outputPer1K: number };

// Placeholder price table; replace with real values where needed
const PRICES: Record<string, Price> = {
  // 'openai:gpt-4o': { inputPer1K: 5, outputPer1K: 15 },
  // 'anthropic:claude-3-opus': { inputPer1K: 15, outputPer1K: 75 },
  // 'gemini:gemini-1.5-pro': { inputPer1K: 3.5, outputPer1K: 10.5 },
  // 'grok:grok-beta': { inputPer1K: 3, outputPer1K: 10 },
};

export function estimateCost(provider: string, model: string, usage?: Usage): number | undefined {
  if (!usage) return undefined;
  const key = `${provider}:${model}`;
  const p = PRICES[key];
  if (!p) return undefined;
  const inCost = (usage.promptTokens ?? 0) * (p.inputPer1K / 1000);
  const outCost = (usage.completionTokens ?? 0) * (p.outputPer1K / 1000);
  return +(inCost + outCost).toFixed(6);
}
