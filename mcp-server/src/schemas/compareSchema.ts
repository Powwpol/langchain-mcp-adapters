import { z } from 'zod';

export const ProviderModelSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'grok']).describe('LLM provider'),
  model: z.string().describe('Model identifier')
});

export const CompareModelsInput = z.object({
  prompt: z.string().optional().describe('Simple text prompt to compare'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.any()
  })).optional().describe('Structured messages to compare'),
  a: ProviderModelSchema.describe('First model to compare'),
  b: ProviderModelSchema.describe('Second model to compare'),
  opts: z.object({
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().positive().optional()
  }).partial().default({}).describe('Generation options')
}).refine(
  (data) => !!data.prompt || !!data.messages,
  { message: 'Either prompt or messages must be provided' }
);

export type CompareModelsInputType = z.infer<typeof CompareModelsInput>;

export interface CompareResult {
  a: {
    text: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    latencyMs: number;
  };
  b: {
    text: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    latencyMs: number;
  };
  diff: string;
  scores: {
    relevance: number;
    consistency: number;
  };
  cost?: number;
}
