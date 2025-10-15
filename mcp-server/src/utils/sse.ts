import { FastifyReply } from 'fastify';
import { ChunkEvent, ResultEvent, ErrorEvent } from '../types.js';

export function sendChunk(reply: FastifyReply, event: ChunkEvent): void {
  const data = `event: chunk\ndata: ${JSON.stringify(event)}\n\n`;
  reply.raw.write(data);
}

export function sendResult(reply: FastifyReply, event: ResultEvent): void {
  const data = `event: result\ndata: ${JSON.stringify(event)}\n\n`;
  reply.raw.write(data);
}

export function sendError(reply: FastifyReply, event: ErrorEvent): void {
  const data = `event: error\ndata: ${JSON.stringify(event)}\n\n`;
  reply.raw.write(data);
}

export function endStream(reply: FastifyReply): void {
  const data = `event: done\ndata: ${JSON.stringify({ status: 'completed' })}\n\n`;
  reply.raw.write(data);
}

export interface SSEMessage {
  event: string;
  data: any;
  id?: string;
}

export function formatSSE(message: SSEMessage): string {
  let output = '';
  
  if (message.id) {
    output += `id: ${message.id}\n`;
  }
  
  output += `event: ${message.event}\n`;
  output += `data: ${JSON.stringify(message.data)}\n\n`;
  
  return output;
}

export function createSSEHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  };
}
