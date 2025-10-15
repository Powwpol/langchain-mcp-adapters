import { CompareModelsInput } from '../schemas/compareSchema.js';
import { parseWithZod } from '../utils/validators.js';
import { runProvider } from './llmGenerate.js';

export async function invoke(args: unknown) {
  const input = parseWithZod(CompareModelsInput, args);

  const messages = input.messages ?? [{ role: 'user', content: input.prompt }];
  const [aRes, bRes] = await Promise.all([
    runProvider({ provider: input.a.provider, model: input.a.model, modality: 'text', messages, inputs: {}, opts: input.opts }),
    runProvider({ provider: input.b.provider, model: input.b.model, modality: 'text', messages, inputs: {}, opts: input.opts }),
  ]);

  const diff = simpleDiff(aRes.text ?? '', bRes.text ?? '');
  const scores = heuristicScores(input.prompt ?? '', aRes.text ?? '', bRes.text ?? '');

  return {
    a: { text: aRes.text, usage: aRes.usage, latencyMs: aRes.latencyMs },
    b: { text: bRes.text, usage: bRes.usage, latencyMs: bRes.latencyMs },
    diff,
    scores,
  };
}

function simpleDiff(a: string, b: string): string {
  if (a === b) return 'identical';
  const al = a.split(/\s+/);
  const bl = b.split(/\s+/);
  const removed = al.filter(x => !bl.includes(x)).slice(0, 50).join(' ');
  const added = bl.filter(x => !al.includes(x)).slice(0, 50).join(' ');
  return `- ${removed}\n+ ${added}`;
}

function heuristicScores(prompt: string, a: string, b: string) {
  const relA = overlap(prompt, a);
  const relB = overlap(prompt, b);
  const consA = 1 - jaccard(a, b) / 2; // dummy consistency proxy
  const consB = consA;
  return { relevance: +(Math.max(relA, relB)).toFixed(2), consistency: +consA.toFixed(2) };
}

function overlap(x: string, y: string): number {
  if (!x || !y) return 0;
  const xs = new Set(x.toLowerCase().split(/\W+/));
  const ys = new Set(y.toLowerCase().split(/\W+/));
  const inter = [...xs].filter(t => ys.has(t)).length;
  return inter / Math.max(1, xs.size);
}

function jaccard(a: string, b: string): number {
  const as = new Set(a.toLowerCase().split(/\W+/));
  const bs = new Set(b.toLowerCase().split(/\W+/));
  const inter = [...as].filter(t => bs.has(t)).length;
  const union = new Set([...as, ...bs]).size;
  return inter / Math.max(1, union);
}
