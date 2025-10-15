import { z } from 'zod';

export const LlmGenerateInput = z.object({
  provider: z.enum(['openai', 'anthropic', 'gemini', 'grok']).describe('LLM provider to use'),
  model: z.string().describe('Model identifier'),
  modality: z.enum(['text', 'vision', 'image', 'audio']).default('text').describe('Input/output modality'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.any() // Can be string or array of {type, data}
  })).describe('Conversation messages'),
  inputs: z.object({
    image: z.string().optional().describe('Base64-encoded image or URL'),
    audio: z.string().optional().describe('Base64-encoded audio or URL')
  }).partial().default({}),
  opts: z.object({
    temperature: z.number().min(0).max(2).default(0.2),
    max_tokens: z.number().positive().optional(),
    tools: z.array(z.any()).optional().describe('Tool definitions for function calling'),
    stream: z.boolean().default(false).describe('Enable streaming response')
  }).partial().default({})
});

export type LlmGenerateInputType = z.infer<typeof LlmGenerateInput>;

export interface LlmGenerateResult {
  text?: string;
  json?: any;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latencyMs: number;
  provider: string;
  model: string;
  cost?: number;
}
