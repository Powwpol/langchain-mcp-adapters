import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const PlanExecuteInput = z.object({
  goal: z.string(),
  constraints: z.array(z.string()).default([]),
  tools_allowed: z.array(z.string()).default(['llm_generate']),
  decomposer: z.object({ provider: z.enum(['openai','anthropic','gemini','grok']), model: z.string() }),
  opts: z.object({ max_depth: z.number().default(3) }).partial().optional(),
});

export const PlanSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  steps: z.array(z.object({
    id: z.string(),
    goal: z.string(),
    inputs: z.record(z.any()).default({}).optional(),
    tool: z.enum(['llm_generate','call_function','search','fetch']).or(z.string()),
    status: z.enum(['pending','running','done','error']).default('pending').optional(),
    result_ref: z.string().optional(),
    parent_id: z.string().optional(),
  })),
  artifacts: z.record(z.string(), z.object({
    type: z.enum(['text','json','file']),
    value: z.any(),
  })).default({}).optional(),
});

export const PlanExecuteJsonSchema = zodToJsonSchema(PlanExecuteInput, {
  name: 'PlanExecuteInput',
  $refStrategy: 'none',
});

export const PlanJsonSchema = zodToJsonSchema(PlanSchema, {
  name: 'PlanSchema',
  $refStrategy: 'none',
});

export type PlanExecuteInputType = z.infer<typeof PlanExecuteInput>;
export type PlanType = z.infer<typeof PlanSchema>;
