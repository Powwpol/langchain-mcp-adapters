import OpenAI from 'openai';
import { ProviderCallParams, ProviderResult } from '../types.js';

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL;
  const client = new OpenAI({ apiKey, baseURL });
  return client;
}

export async function callOpenAI(params: ProviderCallParams): Promise<ProviderResult> {
  const client = getClient();
  const { model, modality, messages, opts, stream, onChunk } = params;
  const start = Date.now();

  // Map messages to OpenAI chat format
  const chatMessages = messages.map((m: any) => {
    if (modality === 'vision' && typeof m.content === 'object' && m.content) {
      return m; // assume already in parts format
    }
    return { role: m.role, content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) };
  });

  const common: any = {
    model,
    messages: chatMessages as any,
    temperature: opts?.temperature ?? 0.2,
    max_tokens: opts?.max_tokens,
    top_p: opts?.top_p,
    presence_penalty: opts?.presence_penalty,
    frequency_penalty: opts?.frequency_penalty,
    stop: opts?.stop,
    response_format: opts?.response_format,
  };

  if (stream) {
    const resp = await client.chat.completions.create({
      ...common,
      stream: true,
    });
    let text = '';
    const asyncStream: any = resp as any;
    for await (const chunk of asyncStream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? '';
      if (delta) {
        text += delta;
        onChunk?.(delta);
      }
    }
    const latencyMs = Date.now() - start;
    return { text, usage: undefined, latencyMs, raw: undefined };
  } else {
    const resp = await client.chat.completions.create(common);
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
