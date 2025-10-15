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
    { name: 'tf_train', description: 'Train a TensorFlow model and stream metrics', input_schema: { type: 'object', properties: { config: { type: 'object', properties: { layers: { type: 'array', items: { type: 'object', properties: { units: { type: 'number' }, activation: { type: 'string' } }, required: ['units'] } }, epochs: { type: 'number' }, batchSize: { type: 'number' } }, required: ['layers'] }, dataset: { type: 'object' } }, required: ['config','dataset'] } },
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
    case 'tf_train':
      return (await import('../tools/tfTrain.js')).invoke(args, options);
    default:
      throw { code: 'TOOL_NOT_FOUND', message: `Unknown tool: ${tool}` };
  }
}
