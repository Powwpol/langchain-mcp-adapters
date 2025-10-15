import Fastify from 'fastify';
import pino from 'pino';
import { config } from './config.js';
import { ToolInvocation, MCPError } from './types.js';
import { validateInput, createError, sanitizeErrorMessage } from './utils/validators.js';
import zodToJsonSchema from 'zod-to-json-schema';

// Import tools
import * as llmGenerate from './tools/llmGenerate.js';
import * as compareModels from './tools/compareModels.js';
import * as planExecute from './tools/planExecute.js';

const TOOLS = {
  llm_generate: llmGenerate,
  compare_models: compareModels,
  plan_execute: planExecute
};

export async function createServer() {
  const logger = pino({
    level: config.logLevel,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        ignore: 'pid,hostname',
        translateTime: 'SYS:standard'
      }
    }
  });

  const server = Fastify({
    logger,
    disableRequestLogging: false,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId'
  });

  // Error handler
  server.setErrorHandler((error, request, reply) => {
    const mcpError: MCPError = {
      code: 'INTERNAL_ERROR',
      message: sanitizeErrorMessage(error),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };

    request.log.error({
      error: error.message,
      stack: error.stack,
      url: request.url
    });

    reply.status(500).send(mcpError);
  });

  // Health check
  server.get('/livez', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  server.get('/readyz', async () => {
    // Could add more sophisticated readiness checks here
    return { 
      status: 'ready', 
      timestamp: new Date().toISOString(),
      providers: {
        openai: !!config.providers.openai.apiKey,
        anthropic: !!config.providers.anthropic.apiKey,
        gemini: !!config.providers.gemini.apiKey,
        grok: !!config.providers.grok.apiKey
      }
    };
  });

  // GET /mcp/tools - List available tools
  server.get('/mcp/tools', async () => {
    const tools = Object.values(TOOLS).map(tool => {
      const schema = zodToJsonSchema(tool.definition.input_schema, {
        name: tool.definition.name,
        $refStrategy: 'none'
      });

      return {
        name: tool.definition.name,
        description: tool.definition.description,
        input_schema: schema
      };
    });

    return { tools };
  });

  // POST /mcp/invoke - Invoke a tool
  server.post<{
    Body: ToolInvocation;
    Querystring: { stream?: string };
  }>('/mcp/invoke', async (request, reply) => {
    const { tool: toolName, arguments: args, stream } = request.body;
    const streamQuery = request.query.stream === 'true';
    const shouldStream = stream || streamQuery;

    const tool = TOOLS[toolName as keyof typeof TOOLS];

    if (!tool) {
      const error: MCPError = createError(
        'INVALID_TOOL',
        `Unknown tool: ${toolName}`,
        { available: Object.keys(TOOLS) }
      );
      return reply.status(400).send(error);
    }

    try {
      // Validate input
      const validatedArgs = validateInput(tool.definition.input_schema as any, args);

      // Execute tool
      if (shouldStream && toolName === 'llm_generate') {
        // SSE streaming mode
        reply.raw.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no'
        });
        
        try {
          await tool.execute(validatedArgs, request.log, reply);
          reply.raw.end();
        } catch (error: any) {
          const errorEvent = `event: error\ndata: ${JSON.stringify({
            id: 'error',
            message: error.message,
            code: 'EXECUTION_ERROR'
          })}\n\n`;
          reply.raw.write(errorEvent);
          reply.raw.end();
        }
      } else {
        // Regular response
        const result = await tool.execute(validatedArgs, request.log);
        return reply.send(result);
      }
    } catch (error: any) {
      request.log.error({
        tool: toolName,
        error: error.message
      });

      const mcpError: MCPError = error.code
        ? error
        : createError('EXECUTION_ERROR', sanitizeErrorMessage(error));

      return reply.status(400).send(mcpError);
    }
  });

  return server;
}

export async function startServer() {
  const server = await createServer();

  try {
    await server.listen({
      port: config.port,
      host: '0.0.0.0'
    });

    server.log.info(`Server listening on port ${config.port}`);
    server.log.info({ tools: Object.keys(TOOLS) }, 'Available tools');

    return server;
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
}
