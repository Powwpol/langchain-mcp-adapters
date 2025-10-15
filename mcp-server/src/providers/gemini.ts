import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProviderCallParams, ProviderResult } from '../types.js';

function getModel(model: string) {
  const apiKey = process.env.GOOGLE_API_KEY;
  const genAI = new GoogleGenerativeAI(apiKey || '');
  return genAI.getGenerativeModel({ model });
}

export async function callGemini(params: ProviderCallParams): Promise<ProviderResult> {
  const { model, messages } = params;
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

  const resp = await (mdl as any).generateContent({ contents: [{ role: 'user', parts }] });
  const text = resp?.response?.text?.() ?? '';
  const latencyMs = Date.now() - start;
  return { text, latencyMs, raw: resp };
}
