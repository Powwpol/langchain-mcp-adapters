import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { Message, ProviderResponse, Modality } from '../types.js';

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: config.providers.anthropic.apiKey
    });
  }
  return client;
}

function normalizeMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages
    .filter(msg => msg.role !== 'system')
    .map(msg => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        };
      }
      
      // Handle multimodal content
      const content: Anthropic.MessageParam['content'] = msg.content.map(part => {
        if (part.type === 'text') {
          return { type: 'text' as const, text: part.data };
        } else if (part.type === 'image') {
          // Anthropic expects base64 without data URI prefix
          const base64Data = part.data.replace(/^data:image\/[a-z]+;base64,/, '');
          return {
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: 'image/jpeg' as const,
              data: base64Data
            }
          };
        }
        return { type: 'text' as const, text: '' };
      });
      
      return {
        role: msg.role as 'user' | 'assistant',
        content
      };
    });
}

function extractSystemMessage(messages: Message[]): string | undefined {
  const systemMsg = messages.find(msg => msg.role === 'system');
  return systemMsg && typeof systemMsg.content === 'string' 
    ? systemMsg.content 
    : undefined;
}

export async function generate(
  model: string,
  messages: Message[],
  _modality: Modality,
  options: {
    temperature?: number;
    max_tokens?: number;
    tools?: any[];
    stream?: boolean;
  } = {}
): Promise<ProviderResponse> {
  const client = getClient();
  const startTime = Date.now();
  
  const params: Anthropic.MessageCreateParams = {
    model,
    messages: normalizeMessages(messages),
    max_tokens: options.max_tokens || 4096,
    temperature: options.temperature ?? 0.2
  };
  
  const systemMessage = extractSystemMessage(messages);
  if (systemMessage) {
    params.system = systemMessage;
  }
  
  if (options.tools && options.tools.length > 0) {
    params.tools = options.tools;
  }
  
  try {
    const response = await client.messages.create(params);
    const latencyMs = Date.now() - startTime;
    
    const textContent = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as Anthropic.TextBlock).text)
      .join('\n');
    
    return {
      text: textContent,
      usage: {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens,
        total_tokens: response.usage.input_tokens + response.usage.output_tokens
      },
      latencyMs,
      raw: response,
      model: response.model
    };
  } catch (error: any) {
    throw new Error(`Anthropic error: ${error.message}`);
  }
}

export async function* generateStream(
  model: string,
  messages: Message[],
  _modality: Modality,
  options: {
    temperature?: number;
    max_tokens?: number;
    tools?: any[];
  } = {}
): AsyncGenerator<string, ProviderResponse, undefined> {
  const client = getClient();
  const startTime = Date.now();
  
  const params: Anthropic.MessageStreamParams = {
    model,
    messages: normalizeMessages(messages),
    max_tokens: options.max_tokens || 4096,
    temperature: options.temperature ?? 0.2,
    stream: true
  };
  
  const systemMessage = extractSystemMessage(messages);
  if (systemMessage) {
    params.system = systemMessage;
  }
  
  if (options.tools && options.tools.length > 0) {
    params.tools = options.tools;
  }
  
  try {
    const stream = client.messages.stream(params);
    
    let fullText = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let modelName = model;
    
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const delta = event.delta.text;
        fullText += delta;
        yield delta;
      } else if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
        modelName = event.message.model;
      } else if (event.type === 'message_delta') {
        outputTokens = event.usage.output_tokens;
      }
    }
    
    const latencyMs = Date.now() - startTime;
    
    return {
      text: fullText,
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens
      },
      latencyMs,
      model: modelName
    };
  } catch (error: any) {
    throw new Error(`Anthropic streaming error: ${error.message}`);
  }
}
