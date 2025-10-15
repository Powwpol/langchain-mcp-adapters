import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderCallParams, ProviderResult } from '../types.js';

function getModel(model: string) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey || '');
  return genAI.getGenerativeModel({ model });
}

export async function callGemini(params: ProviderCallParams): Promise<ProviderResult> {
  const { model, messages, opts } = params;
  const start = Date.now();
  const mdl = getModel(model);

  const parts: any[] = [];
  for (const m of messages) {
    if (typeof m.content === 'string') {
      parts.push(m.content);
    } else {
      parts.push(JSON.stringify(m.content));
    }
  }

  const genOpts: any = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: opts?.temperature,
      topP: opts?.top_p,
      topK: opts?.top_k,
      maxOutputTokens: opts?.max_tokens,
      candidateCount: opts?.candidate_count,
      stopSequences: Array.isArray(opts?.stop) ? opts?.stop : (typeof opts?.stop === 'string' ? [opts?.stop] : undefined),
      seed: opts?.seed,
    },
  };
  const resp = await (mdl as any).generateContent(genOpts);
  const text = resp?.response?.text?.() ?? '';
  const latencyMs = Date.now() - start;
  return { text, latencyMs, raw: resp };
}
