import { CompareModelsInput, CompareModelsInputType, CompareResult } from '../schemas/compareSchema.js';
import { Message } from '../types.js';
import * as openai from '../providers/openai.js';
import * as anthropic from '../providers/anthropic.js';
import * as gemini from '../providers/gemini.js';
import * as grok from '../providers/grok.js';
import { estimateCost } from '../utils/cost.js';

const PROVIDERS = {
  openai,
  anthropic,
  gemini,
  grok
};

function prepareMessages(
  prompt?: string,
  messages?: any[]
): Message[] {
  if (messages) {
    return messages as Message[];
  }
  
  if (prompt) {
    return [{ role: 'user', content: prompt }];
  }
  
  throw new Error('Either prompt or messages must be provided');
}

function calculateDiff(textA: string, textB: string): string {
  const lengthDiff = Math.abs(textA.length - textB.length);
  const percentDiff = ((lengthDiff / Math.max(textA.length, textB.length)) * 100).toFixed(1);
  
  return `Length difference: ${lengthDiff} characters (${percentDiff}%). ` +
    `Model A: ${textA.length} chars, Model B: ${textB.length} chars.`;
}

function calculateScores(textA: string, textB: string): { relevance: number; consistency: number } {
  // Simple heuristic scoring
  // Relevance: based on length (longer responses might be more detailed)
  const avgLength = (textA.length + textB.length) / 2;
  const relevance = Math.min(avgLength / 1000, 1); // Normalize to 0-1
  
  // Consistency: based on similarity (simple character overlap)
  const setA = new Set(textA.toLowerCase().split(/\s+/));
  const setB = new Set(textB.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  const consistency = union.size > 0 ? intersection.size / union.size : 0;
  
  return {
    relevance: parseFloat(relevance.toFixed(2)),
    consistency: parseFloat(consistency.toFixed(2))
  };
}

export async function execute(
  args: CompareModelsInputType,
  logger: any
): Promise<CompareResult> {
  const { prompt, messages, a, b, opts } = args;
  
  const preparedMessages = prepareMessages(prompt, messages);
  
  const providerA = PROVIDERS[a.provider];
  const providerB = PROVIDERS[b.provider];
  
  logger.info({
    tool: 'compare_models',
    modelA: `${a.provider}/${a.model}`,
    modelB: `${b.provider}/${b.model}`
  });
  
  try {
    // Execute both models in parallel
    const [responseA, responseB] = await Promise.all([
      providerA.generate(a.model, preparedMessages, 'text', opts),
      providerB.generate(b.model, preparedMessages, 'text', opts)
    ]);
    
    const diff = calculateDiff(responseA.text, responseB.text);
    const scores = calculateScores(responseA.text, responseB.text);
    
    const costA = estimateCost(a.model, responseA.usage.prompt_tokens, responseA.usage.completion_tokens);
    const costB = estimateCost(b.model, responseB.usage.prompt_tokens, responseB.usage.completion_tokens);
    
    const totalCost = (costA?.total_cost || 0) + (costB?.total_cost || 0);
    
    logger.info({
      tool: 'compare_models',
      modelA: `${a.provider}/${a.model}`,
      modelB: `${b.provider}/${b.model}`,
      latencyA: responseA.latencyMs,
      latencyB: responseB.latencyMs,
      tokensA: responseA.usage,
      tokensB: responseB.usage,
      scores,
      totalCost
    });
    
    return {
      a: {
        text: responseA.text,
        usage: responseA.usage,
        latencyMs: responseA.latencyMs
      },
      b: {
        text: responseB.text,
        usage: responseB.usage,
        latencyMs: responseB.latencyMs
      },
      diff,
      scores,
      cost: totalCost > 0 ? totalCost : undefined
    };
  } catch (error: any) {
    logger.error({
      tool: 'compare_models',
      error: error.message
    });
    throw error;
  }
}

export const definition = {
  name: 'compare_models',
  description: 'Compare responses from two different LLM models side-by-side',
  input_schema: CompareModelsInput
};
