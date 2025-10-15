import { FastifyReply } from 'fastify';
import { LlmGenerateInput, LlmGenerateInputType, LlmGenerateResult } from '../schemas/llmGenerateSchema.js';
import { Provider, Message, Modality } from '../types.js';
import * as openai from '../providers/openai.js';
import * as anthropic from '../providers/anthropic.js';
import * as gemini from '../providers/gemini.js';
import * as grok from '../providers/grok.js';
import { validateProviderModality } from '../utils/router.js';
import { estimateCost } from '../utils/cost.js';
import { sendChunk, sendResult, sendError, endStream } from '../utils/sse.js';
import { randomUUID } from 'crypto';

const PROVIDERS = {
  openai,
  anthropic,
  gemini,
  grok
};

function prepareMessages(
  messages: any[],
  inputs: { image?: string; audio?: string }
): Message[] {
  // If inputs contain image or audio, add them to the last user message
  if (inputs.image || inputs.audio) {
    const lastUserMsgIdx = messages.map(m => m.role).lastIndexOf('user');
    if (lastUserMsgIdx !== -1) {
      const msg = messages[lastUserMsgIdx];
      const content: any[] = [];
      
      if (typeof msg.content === 'string') {
        content.push({ type: 'text', data: msg.content });
      } else if (Array.isArray(msg.content)) {
        content.push(...msg.content);
      }
      
      if (inputs.image) {
        content.push({ type: 'image', data: inputs.image });
      }
      
      if (inputs.audio) {
        content.push({ type: 'audio', data: inputs.audio });
      }
      
      messages[lastUserMsgIdx] = { ...msg, content };
    }
  }
  
  return messages as Message[];
}

export async function execute(
  args: LlmGenerateInputType,
  logger: any,
  reply?: FastifyReply
): Promise<LlmGenerateResult> {
  const { provider, model, modality, messages: rawMessages, inputs, opts } = args;
  
  // Validate provider supports modality
  validateProviderModality(provider, modality);
  
  // Prepare messages with inputs
  const messages = prepareMessages([...rawMessages], inputs);
  
  const providerModule = PROVIDERS[provider];
  
  try {
    if (opts.stream && reply) {
      // Streaming mode
      return await executeStream(
        providerModule,
        provider,
        model,
        messages,
        modality,
        opts,
        logger,
        reply
      );
    } else {
      // Non-streaming mode
      const response = await providerModule.generate(
        model,
        messages,
        modality,
        opts
      );
      
      const cost = estimateCost(
        model,
        response.usage.prompt_tokens,
        response.usage.completion_tokens
      );
      
      logger.info({
        tool: 'llm_generate',
        provider,
        model,
        latencyMs: response.latencyMs,
        tokens: response.usage,
        cost
      });
      
      return {
        text: response.text,
        usage: response.usage,
        latencyMs: response.latencyMs,
        provider,
        model: response.model || model,
        cost: cost?.total_cost
      };
    }
  } catch (error: any) {
    logger.error({
      tool: 'llm_generate',
      provider,
      model,
      error: error.message
    });
    throw error;
  }
}

async function executeStream(
  providerModule: any,
  provider: Provider,
  model: string,
  messages: Message[],
  modality: Modality,
  opts: any,
  logger: any,
  reply: FastifyReply
): Promise<LlmGenerateResult> {
  const id = randomUUID();
  
  try {
    const stream = providerModule.generateStream(
      model,
      messages,
      modality,
      opts
    );
    
    let fullText = '';
    
    for await (const delta of stream) {
      fullText += delta;
      sendChunk(reply, {
        id,
        provider,
        model,
        delta
      });
    }
    
    // Get final response from generator return value
    const response = await stream.next();
    const finalResponse = response.value;
    
    const cost = estimateCost(
      model,
      finalResponse.usage.prompt_tokens,
      finalResponse.usage.completion_tokens
    );
    
    const result: LlmGenerateResult = {
      text: fullText,
      usage: finalResponse.usage,
      latencyMs: finalResponse.latencyMs,
      provider,
      model: finalResponse.model || model,
      cost: cost?.total_cost
    };
    
    sendResult(reply, { id, output: result });
    endStream(reply);
    
    logger.info({
      tool: 'llm_generate',
      provider,
      model,
      latencyMs: result.latencyMs,
      tokens: result.usage,
      cost,
      stream: true
    });
    
    return result;
  } catch (error: any) {
    sendError(reply, {
      id,
      message: error.message,
      code: 'GENERATION_ERROR'
    });
    throw error;
  }
}

export const definition = {
  name: 'llm_generate',
  description: 'Generate text, vision, image, or audio using various LLM providers (OpenAI, Anthropic, Gemini, Grok)',
  input_schema: LlmGenerateInput
};
