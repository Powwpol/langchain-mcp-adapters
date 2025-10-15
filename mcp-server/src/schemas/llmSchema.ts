import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const LlmGenerateInput = z.object({
  provider: z.enum(['openai','anthropic','gemini','grok']),
  model: z.string(),
  modality: z.enum(['text','vision','image','audio']).default('text'),
  messages: z.array(z.object({
    role: z.enum(['system','user','assistant','tool']),
    content: z.any()
  })),
  inputs: z.object({
    image: z.string().optional(),
    audio: z.string().optional(),
  }).partial().optional(),
  opts: z.object({
    temperature: z.number().min(0).max(2).optional(),
    max_tokens: z.number().optional(),
    top_p: z.number().min(0).max(1).optional(),
    top_k: z.number().int().min(1).optional(),
    presence_penalty: z.number().min(-2).max(2).optional(),
    frequency_penalty: z.number().min(-2).max(2).optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    candidate_count: z.number().int().min(1).max(8).optional(),
    seed: z.number().optional(),
    response_format: z.any().optional(),
    tools: z.array(z.any()).optional(),
  }).partial().optional(),
});

export const LlmGenerateJsonSchema = zodToJsonSchema(LlmGenerateInput, {
  name: 'LlmGenerateInput',
  $refStrategy: 'none',
});

export type LlmGenerateInputType = z.infer<typeof LlmGenerateInput>;
