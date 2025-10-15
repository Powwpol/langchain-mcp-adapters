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
    temperature: z.number().min(0).max(2).default(0.2).optional(),
    max_tokens: z.number().optional(),
    tools: z.array(z.any()).optional(),
  }).partial().optional(),
});

export const LlmGenerateJsonSchema = zodToJsonSchema(LlmGenerateInput, {
  name: 'LlmGenerateInput',
  $refStrategy: 'none',
});

export type LlmGenerateInputType = z.infer<typeof LlmGenerateInput>;
