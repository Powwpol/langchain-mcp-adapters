import { z } from 'zod';
import { LlmGenerateInput, LlmGenerateInputType } from '../schemas/llmSchema.js';
import { parseWithZod } from '../utils/validators.js';
import { ProviderResult } from '../types.js';
import { sendChunk } from '../utils/sse.js';
import { callOpenAI } from '../providers/openai.js';
import { callAnthropic } from '../providers/anthropic.js';
import { callGemini } from '../providers/gemini.js';
import { callGrok } from '../providers/grok.js';

export type InvokeOptions = { stream?: boolean; sseSource?: { write: (e: any) => void; end: () => void }; requestId?: string };

export async function runProvider(input: LlmGenerateInputType, options?: InvokeOptions): Promise<ProviderResult> {
  const { provider } = input;
  const stream = options?.stream ?? false;
  const onChunk = stream && options?.sseSource ? (delta: string) => {
    const id = options?.requestId || 'llm';
    sendChunk(options.sseSource!, { id, provider: provider as any, model: input.model, delta });
  } : undefined;

  const params = {
    provider: input.provider as any,
    model: input.model,
    modality: input.modality,
    messages: input.messages as any,
    inputs: input.inputs,
    opts: input.opts,
    stream,
    onChunk,
  } as const;

  switch (provider) {
    case 'openai':
      return callOpenAI(params);
    case 'anthropic':
      return callAnthropic(params);
    case 'gemini':
      return callGemini(params);
    case 'grok':
      return callGrok(params);
    default:
      throw { code: 'PROVIDER_UNSUPPORTED', message: `Unsupported provider: ${provider}` };
  }
}

export async function invoke(args: unknown, options?: InvokeOptions) {
  const input = parseWithZod(LlmGenerateInput, args);
  const res = await runProvider({
    provider: input.provider,
    model: input.model,
    modality: input.modality ?? 'text',
    messages: input.messages,
    inputs: input.inputs,
    opts: input.opts,
  } as any, options);
  return {
    text: res.text,
    json: res.json,
    usage: res.usage,
    latencyMs: res.latencyMs,
    provider: input.provider,
    model: input.model,
  };
}
