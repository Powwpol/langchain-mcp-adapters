import { FastifyReply } from 'fastify';
import { SseChunkEvent, SseErrorEvent, SseResultEvent } from '../types.js';

export type SseSource = {
  write: (event: { event: string; data: string; id?: string }) => void;
  end: () => void;
};

export function openSse(reply: FastifyReply): SseSource {
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  (reply.raw as any).flushHeaders?.();

  let closed = false;
  reply.raw.on('close', () => { closed = true; });

  const write = (event: { event: string; data: string; id?: string }) => {
    if (closed) return;
    const lines: string[] = [];
    if (event.id) lines.push(`id: ${event.id}`);
    if (event.event) lines.push(`event: ${event.event}`);
    const dataLines = String(event.data).split(/\r?\n/).map(l => `data: ${l}`);
    const payload = [...lines, ...dataLines, ''].join('\n') + '\n';
    reply.raw.write(payload);
  };

  const end = () => { if (!closed) reply.raw.end(); };

  return { write, end };
}

export function sendChunk(source: SseSource, ev: SseChunkEvent) {
  source.write({ event: 'chunk', data: JSON.stringify(ev), id: ev.id });
}

export function sendResult(source: SseSource, ev: SseResultEvent) {
  source.write({ event: 'result', data: JSON.stringify(ev), id: ev.id });
}

export function sendError(source: SseSource, ev: SseErrorEvent) {
  source.write({ event: 'error', data: JSON.stringify(ev), id: ev.id });
}
