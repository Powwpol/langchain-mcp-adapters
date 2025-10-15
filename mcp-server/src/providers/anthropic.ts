import Anthropic from '@anthropic-ai/sdk';
import { ProviderCallParams, ProviderResult } from '../types.js';

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return new (Anthropic as any)({ apiKey });
}

export async function callAnthropic(params: ProviderCallParams): Promise<ProviderResult> {
  const client = getClient();
  const { model, messages, opts } = params;
  const start = Date.now();

  const system = messages.find(m => m.role === 'system');
  const contentMessages = messages.filter(m => m.role !== 'system').map((m: any) => {
    if (Array.isArray(m.content)) return { role: m.role, content: m.content };
    return { role: m.role, content: [{ type: 'text', text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }] };
  });

  const resp = await (client as any).messages.create({
    model,
    max_tokens: opts?.max_tokens ?? 1024,
    temperature: opts?.temperature ?? 0.2,
    system: system && typeof system.content === 'string' ? system.content : undefined,
    messages: contentMessages,
    tools: opts?.tools as any,
  });

  const text = resp?.content?.map((p: any) => (p.type === 'text' ? p.text : '')).join('') ?? '';
  const usage = resp?.usage ? {
    promptTokens: resp.usage.input_tokens ?? undefined,
    completionTokens: resp.usage.output_tokens ?? undefined,
    totalTokens: (resp.usage.input_tokens ?? 0) + (resp.usage.output_tokens ?? 0),
  } : undefined;
  const latencyMs = Date.now() - start;
  return { text, usage, latencyMs, raw: resp };
}
