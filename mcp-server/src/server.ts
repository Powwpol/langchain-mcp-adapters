import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import pino from 'pino';
import { AppConfig } from './config.js';
import { ToolDescriptor, StandardError } from './types.js';
import { getToolsList, invokeTool } from './utils/router.js';
import { openSse } from './utils/sse.js';

export function buildServer(cfg: AppConfig): FastifyInstance {
  const app = Fastify({ logger: cfg.logger as pino.LoggerOptions });

  app.get('/livez', async (_req, _reply) => {
    return { status: 'ok' };
  });

  app.get('/mcp/tools', async (_req, reply) => {
    const tools: ToolDescriptor[] = getToolsList();
    return reply.send({ tools });
  });

  type InvokeBody = {
    tool: string;
    arguments?: unknown;
  };

  app.post('/mcp/invoke', async (req: FastifyRequest<{ Body: InvokeBody; Querystring: { stream?: string } }>, reply: FastifyReply) => {
    const { tool, arguments: args } = req.body ?? { tool: '', arguments: {} };
    const stream = String((req.query as any)?.stream ?? '') === 'true' || Boolean((req.headers as any)['x-mcp-stream']);

    if (!tool) {
      return reply.status(400).send(wrapError(normalizeError('BAD_REQUEST', 'tool requis')));
    }

    if (stream) {
      const source = openSse(reply);
      const id = `${Date.now()}`;
      source.write({ event: 'tool_call', data: JSON.stringify({ id, tool }) });
      try {
        const output = await invokeTool(tool, args, { stream: true, sseSource: source, requestId: id });
        source.write({ event: 'result', data: JSON.stringify({ id, output }) });
      } catch (err: any) {
        const e = toStandardError(err);
        source.write({ event: 'error', data: JSON.stringify({ id, message: e.message }) });
      } finally {
        source.end();
      }
      return reply;
    }

    try {
      const output = await invokeTool(tool, args, { stream: false });
      return reply.send({ ok: true, output });
    } catch (err: any) {
      const e = toStandardError(err);
      return reply.status(400).send(wrapError(e));
    }
  });

  app.setErrorHandler((error, _req, reply) => {
    const e = toStandardError(error);
    reply.status(500).send(wrapError(e));
  });

  return app;
}

function normalizeError(code: string, message: string, details?: unknown): StandardError {
  return { code, message, details };
}

function wrapError(e: StandardError) {
  return { ok: false, error: e };
}

function toStandardError(err: any): StandardError {
  if (!err) return normalizeError('UNKNOWN', 'Unknown error');
  if (typeof err.code === 'string' && typeof err.message === 'string') {
    return { code: err.code, message: err.message, details: err.details };
  }
  return normalizeError(err.code ?? 'ERROR', err.message ?? String(err));
}
