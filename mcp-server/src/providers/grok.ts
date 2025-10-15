import OpenAI from 'openai';
import { ProviderCallParams, ProviderResult } from '../types.js';

function getClient(): OpenAI {
  const apiKey = process.env.XAI_API_KEY;
  const baseURL = process.env.GROK_BASE_URL || 'https://api.x.ai/v1';
  const client = new OpenAI({ apiKey, baseURL });
  return client;
}

export async function callGrok(params: ProviderCallParams): Promise<ProviderResult> {
  const client = getClient();
  const { model, messages, opts, stream, onChunk } = params;
  const start = Date.now();
  const chatMessages = messages.map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }));

  if (stream) {
    const resp = await client.chat.completions.create({
      model,
      messages: chatMessages as any,
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.max_tokens,
      stream: true,
    });
    let text = '';
    for await (const chunk of resp) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        text += delta;
        onChunk?.(delta);
      }
    }
    const latencyMs = Date.now() - start;
    return { text, latencyMs };
  } else {
    const resp = await client.chat.completions.create({
      model,
      messages: chatMessages as any,
      temperature: opts?.temperature ?? 0.2,
      max_tokens: opts?.max_tokens,
    });
    const text = resp.choices?.[0]?.message?.content ?? '';
    const usage = resp.usage ? {
      promptTokens: resp.usage.prompt_tokens ?? undefined,
      completionTokens: resp.usage.completion_tokens ?? undefined,
      totalTokens: resp.usage.total_tokens ?? undefined,
    } : undefined;
    const latencyMs = Date.now() - start;
    return { text, usage, latencyMs, raw: resp };
  }
}
