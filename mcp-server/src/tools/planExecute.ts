import { randomUUID } from 'crypto';
import { PlanExecuteInput, PlanExecuteInputType, PlanSchemaType } from '../schemas/planSchema.js';
import { Message, PlanStep } from '../types.js';
import * as openai from '../providers/openai.js';
import * as anthropic from '../providers/anthropic.js';
import * as gemini from '../providers/gemini.js';
import * as grok from '../providers/grok.js';
import { execute as executeLlmGenerate } from './llmGenerate.js';

const PROVIDERS = {
  openai,
  anthropic,
  gemini,
  grok
};

const DECOMPOSITION_PROMPT = `You are a task decomposition system. Given a goal, break it down into concrete, actionable steps.

Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
{
  "steps": [
    {
      "id": "step-1",
      "goal": "Clear description of what this step achieves",
      "tool": "llm_generate",
      "inputs": {}
    }
  ]
}

Rules:
- Each step must have a unique id (step-1, step-2, etc.)
- Goal should be specific and actionable
- Tool should be one of: llm_generate, call_function, search, fetch
- Keep steps simple and sequential
- Maximum {max_depth} steps
- Focus on what needs to be done, not how to think about it

Goal: {goal}
Constraints: {constraints}
Allowed tools: {tools_allowed}`;

async function decomposeGoal(
  goal: string,
  constraints: string[],
  toolsAllowed: string[],
  decomposer: { provider: string; model: string },
  maxDepth: number,
  logger: any
): Promise<PlanStep[]> {
  const providerModule = PROVIDERS[decomposer.provider as keyof typeof PROVIDERS];
  
  const prompt = DECOMPOSITION_PROMPT
    .replace('{goal}', goal)
    .replace('{constraints}', constraints.join(', ') || 'none')
    .replace('{tools_allowed}', toolsAllowed.join(', '))
    .replace('{max_depth}', maxDepth.toString());
  
  const messages: Message[] = [
    {
      role: 'user',
      content: prompt
    }
  ];
  
  try {
    const response = await providerModule.generate(
      decomposer.model,
      messages,
      'text',
      { temperature: 0.1 }
    );
    
    // Parse JSON response
    let jsonText = response.text.trim();
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    
    const parsed = JSON.parse(jsonText);
    
    if (!parsed.steps || !Array.isArray(parsed.steps)) {
      throw new Error('Invalid plan structure: missing steps array');
    }
    
    // Normalize steps
    const steps: PlanStep[] = parsed.steps.slice(0, maxDepth).map((step: any) => ({
      id: step.id || randomUUID(),
      goal: step.goal || '',
      inputs: step.inputs || {},
      tool: step.tool || 'llm_generate',
      status: 'pending' as const,
      result_ref: undefined,
      parent_id: undefined
    }));
    
    return steps;
  } catch (error: any) {
    logger.error({
      tool: 'plan_execute',
      phase: 'decomposition',
      error: error.message
    });
    
    // Fallback: create a single step
    return [
      {
        id: 'step-1',
        goal,
        inputs: {},
        tool: 'llm_generate',
        status: 'pending',
        result_ref: undefined,
        parent_id: undefined
      }
    ];
  }
}

async function executeStep(
  step: PlanStep,
  _plan: PlanSchemaType,
  logger: any
): Promise<{ result: any; updated_step: PlanStep }> {
  const updatedStep = { ...step, status: 'running' as const };
  
  try {
    let result: any;
    
    if (step.tool === 'llm_generate') {
      // Execute LLM generation
      const args = {
        provider: step.inputs.provider || 'openai',
        model: step.inputs.model || 'gpt-4o-mini',
        modality: step.inputs.modality || 'text',
        messages: step.inputs.messages || [
          { role: 'user', content: step.goal }
        ],
        inputs: step.inputs.inputs || {},
        opts: step.inputs.opts || {}
      };
      
      result = await executeLlmGenerate(args, logger);
    } else {
      // For other tools, just store the goal as result
      result = {
        tool: step.tool,
        goal: step.goal,
        status: 'not_implemented',
        message: `Tool ${step.tool} is not yet implemented`
      };
    }
    
    return {
      result,
      updated_step: {
        ...updatedStep,
        status: 'done',
        result_ref: `artifact-${step.id}`
      }
    };
  } catch (error: any) {
    logger.error({
      tool: 'plan_execute',
      step: step.id,
      error: error.message
    });
    
    return {
      result: { error: error.message },
      updated_step: {
        ...updatedStep,
        status: 'error'
      }
    };
  }
}

export async function execute(
  args: PlanExecuteInputType,
  logger: any
): Promise<{ plan: PlanSchemaType; summary: string }> {
  const { goal, constraints, tools_allowed, decomposer, opts } = args;
  const maxDepth = opts.max_depth || 3;
  
  logger.info({
    tool: 'plan_execute',
    goal,
    decomposer: `${decomposer.provider}/${decomposer.model}`
  });
  
  // Step 1: Decompose goal into steps
  const steps = await decomposeGoal(
    goal,
    constraints,
    tools_allowed,
    decomposer,
    maxDepth,
    logger
  );
  
  // Step 2: Create plan
  const plan: PlanSchemaType = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    steps,
    artifacts: {}
  };
  
  // Step 3: Execute steps sequentially
  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    
    logger.info({
      tool: 'plan_execute',
      phase: 'execution',
      step: step.id,
      goal: step.goal
    });
    
    const { result, updated_step } = await executeStep(step, plan, logger);
    
    // Update step in plan
    plan.steps[i] = updated_step;
    
    // Store result in artifacts
    if (updated_step.result_ref) {
      plan.artifacts[updated_step.result_ref] = {
        type: typeof result === 'string' ? 'text' : 'json',
        value: result
      };
    }
  }
  
  // Step 4: Generate summary
  const completedSteps = plan.steps.filter(s => s.status === 'done').length;
  const errorSteps = plan.steps.filter(s => s.status === 'error').length;
  
  const summary = `Plan execution completed. ` +
    `${completedSteps}/${plan.steps.length} steps succeeded, ` +
    `${errorSteps} failed. ` +
    `Goal: "${goal}"`;
  
  logger.info({
    tool: 'plan_execute',
    phase: 'completed',
    plan_id: plan.id,
    total_steps: plan.steps.length,
    completed: completedSteps,
    errors: errorSteps
  });
  
  return { plan, summary };
}

export const definition = {
  name: 'plan_execute',
  description: 'Decompose a goal into structured steps and execute them sequentially. Returns a structured plan without free-form reasoning.',
  input_schema: PlanExecuteInput
};
