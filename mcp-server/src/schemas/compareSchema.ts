import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const CompareModelsInput = z.object({
  prompt: z.string().optional(),
  messages: z.array(z.any()).optional(),
  a: z.object({ provider: z.enum(['openai','anthropic','gemini','grok']), model: z.string() }),
  b: z.object({ provider: z.enum(['openai','anthropic','gemini','grok']), model: z.string() }),
  opts: z.object({ temperature: z.number().optional(), max_tokens: z.number().optional() }).partial().optional(),
}).refine(d => !!d.prompt || !!d.messages, { message: 'prompt ou messages requis' });

export const CompareModelsJsonSchema = zodToJsonSchema(CompareModelsInput, {
  name: 'CompareModelsInput',
  $refStrategy: 'none',
});

export type CompareModelsInputType = z.infer<typeof CompareModelsInput>;
