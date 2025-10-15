import { z } from 'zod';

export const PlanExecuteInput = z.object({
  goal: z.string().describe('The main goal to achieve'),
  constraints: z.array(z.string()).default([]).describe('Constraints to respect during execution'),
  tools_allowed: z.array(z.string()).default(['llm_generate']).describe('List of allowed tools for execution'),
  decomposer: z.object({
    provider: z.enum(['openai', 'anthropic', 'gemini', 'grok']).describe('Provider to use for decomposition'),
    model: z.string().describe('Model to use for decomposition')
  }).describe('LLM configuration for task decomposition'),
  opts: z.object({
    max_depth: z.number().default(3).describe('Maximum depth for task decomposition')
  }).partial().default({})
});

export type PlanExecuteInputType = z.infer<typeof PlanExecuteInput>;

export const PlanSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  steps: z.array(z.object({
    id: z.string(),
    goal: z.string(),
    inputs: z.record(z.any()).default({}),
    tool: z.enum(['llm_generate', 'call_function', 'search', 'fetch']).or(z.string()),
    status: z.enum(['pending', 'running', 'done', 'error']).default('pending'),
    result_ref: z.string().optional(),
    parent_id: z.string().optional()
  })),
  artifacts: z.record(z.string(), z.object({
    type: z.enum(['text', 'json', 'file']),
    value: z.any()
  })).default({})
});

export type PlanSchemaType = z.infer<typeof PlanSchema>;
