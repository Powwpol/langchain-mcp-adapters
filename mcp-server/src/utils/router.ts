import { ToolDescriptor } from '../types.js';
import { LlmGenerateJsonSchema } from '../schemas/llmSchema.js';
import { CompareModelsJsonSchema } from '../schemas/compareSchema.js';
import { PlanExecuteJsonSchema } from '../schemas/planSchema.js';
import * as llmGenerate from '../tools/llmGenerate.js';
import * as compareModels from '../tools/compareModels.js';
import * as planExecute from '../tools/planExecute.js';

export function getToolsList(): ToolDescriptor[] {
  return [
    { name: 'llm_generate', description: 'Generate text/json via selected provider', input_schema: LlmGenerateJsonSchema },
    { name: 'compare_models', description: 'Compare two models on a prompt/messages', input_schema: CompareModelsJsonSchema },
    { name: 'plan_execute', description: 'Plan then execute steps with allowed tools', input_schema: PlanExecuteJsonSchema },
  ];
}

export type InvokeOptions = { stream?: boolean; sseSource?: { write: (e: any) => void; end: () => void }; requestId?: string };

export async function invokeTool(tool: string, args: unknown, options: InvokeOptions): Promise<unknown> {
  switch (tool) {
    case 'llm_generate':
      return llmGenerate.invoke(args, options);
    case 'compare_models':
      return compareModels.invoke(args);
    case 'plan_execute':
      return planExecute.invoke(args, options);
    default:
      throw { code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${tool}` };
  }
}
