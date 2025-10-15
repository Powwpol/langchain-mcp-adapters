import { PlanExecuteInput, PlanSchema, PlanType } from '../schemas/planSchema.js';
import { parseWithZod } from '../utils/validators.js';
import { runProvider } from './llmGenerate.js';
import { randomUUID } from 'node:crypto';
import { request } from 'undici';

export type InvokeOptions = { stream?: boolean; sseSource?: { write: (e: any) => void; end: () => void } };

export async function invoke(args: unknown, _options?: InvokeOptions) {
  const input = parseWithZod(PlanExecuteInput, args);

  const plan = await createPlan(input);
  const executed = await executePlan(plan, input.tools_allowed ?? ['llm_generate']);

  const summary = summarizePlan(executed);
  return { plan: executed, summary };
}

async function createPlan(input: any): Promise<PlanType> {
  const sys = `You are a planner. Output JSON ONLY matching PlanSchema. No chain-of-thought. Provide steps to achieve the goal with allowed tools.`;
  const user = `Goal: ${input.goal}\nConstraints: ${input.constraints?.join('; ')}`;
  const res = await runProvider({ provider: input.decomposer.provider, model: input.decomposer.model, modality: 'text', messages: [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ], inputs: {}, opts: { temperature: 0 } });

  let plan: any | undefined;
  try {
    plan = JSON.parse(res.text || '');
  } catch {}

  if (!plan) {
    plan = {
      id: randomUUID(),
      created_at: new Date().toISOString(),
      steps: [
        { id: randomUUID(), goal: input.goal, tool: 'llm_generate', inputs: { provider: 'openai', model: 'gpt-4o-mini', messages: [{ role: 'user', content: input.goal }], modality: 'text' }, status: 'pending' },
      ],
      artifacts: {},
    };
  }

  const parsed = parseWithZod(PlanSchema, plan);
  return parsed;
}

async function executePlan(plan: PlanType, toolsAllowed: string[]): Promise<PlanType> {
  const artifacts: Record<string, any> = plan.artifacts ?? {};
  const steps = [] as PlanType['steps'];
  for (const step of plan.steps) {
    const s = { ...step } as any;
    if (!toolsAllowed.includes(String(s.tool))) {
      s.status = 'error';
      s.result_ref = `artifact:${s.id}:error`;
      artifacts[s.result_ref] = { type: 'text', value: `Tool not allowed: ${s.tool}` };
      steps.push(s);
      continue;
    }

    s.status = 'running';
    try {
      if (s.tool === 'llm_generate') {
        const inp = s.inputs || {};
        const res = await runProvider({
          provider: inp.provider || 'openai',
          model: inp.model || 'gpt-4o-mini',
          modality: inp.modality || 'text',
          messages: inp.messages || [{ role: 'user', content: plan.id }],
          inputs: inp.inputs || {},
          opts: inp.opts || {},
        });
        const ref = `artifact:${s.id}:text`;
        artifacts[ref] = { type: 'text', value: res.text };
        s.result_ref = ref;
        s.status = 'done';
      } else if (s.tool === 'fetch') {
        const url = s.inputs?.url;
        const method = s.inputs?.method || 'GET';
        const body = s.inputs?.body;
        const { body: resBody } = await request(url, { method, body: body ? JSON.stringify(body) : undefined });
        const text = await resBody.text();
        const ref = `artifact:${s.id}:fetch`;
        artifacts[ref] = { type: 'text', value: text };
        s.result_ref = ref;
        s.status = 'done';
      } else {
        s.status = 'error';
        const ref = `artifact:${s.id}:unsupported`;
        artifacts[ref] = { type: 'text', value: `Unsupported tool: ${s.tool}` };
        s.result_ref = ref;
      }
    } catch (err: any) {
      s.status = 'error';
      const ref = `artifact:${s.id}:error`;
      artifacts[ref] = { type: 'text', value: String(err?.message || err) };
      s.result_ref = ref;
    }
    steps.push(s);
  }
  return { ...plan, steps, artifacts } as any;
}

function summarizePlan(plan: PlanType): string {
  const done = plan.steps.filter(s => s.status === 'done').length;
  const total = plan.steps.length;
  return `Executed ${done}/${total} steps. Final artifacts: ${Object.keys(plan.artifacts || {}).length}`;
}
