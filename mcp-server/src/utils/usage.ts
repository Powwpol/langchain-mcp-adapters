import { Usage } from '../types.js';

export function sumUsage(a?: Usage, b?: Usage): Usage | undefined {
  if (!a && !b) return undefined;
  const ra = a ?? {};
  const rb = b ?? {};
  return {
    promptTokens: num(ra.promptTokens) + num(rb.promptTokens),
    completionTokens: num(ra.completionTokens) + num(rb.completionTokens),
    totalTokens: num(ra.totalTokens) + num(rb.totalTokens),
  };
}

export function estimateTokensFromText(text?: string): Usage {
  const t = text ?? '';
  const tokens = Math.ceil(t.length / 4); // rough heuristic
  return { promptTokens: undefined, completionTokens: tokens, totalTokens: tokens };
}

function num(v?: number) { return typeof v === 'number' ? v : 0; }
