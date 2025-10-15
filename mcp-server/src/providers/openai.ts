import OpenAI from 'openai';
import { config } from '../config.js';
import { Message, ProviderResponse, Modality } from '../types.js';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const cfg = config.providers.openai;
    client = new OpenAI({
      apiKey: cfg.apiKey,
      baseURL: cfg.baseURL
    });
  }
  return client;
}

function normalizeMessages(messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map(msg => {
    const role = msg.role as 'system' | 'user' | 'assistant';
    
    if (typeof msg.content === 'string') {
      return { role, content: msg.content } as OpenAI.Chat.ChatCompletionMessageParam;
    }
    
    // Handle multimodal content
    const content: OpenAI.Chat.ChatCompletionContentPart[] = msg.content.map(part => {
      if (part.type === 'text') {
        return { type: 'text', text: part.data };
      } else if (part.type === 'image') {
        // Check if URL or base64
        const imageUrl = part.data.startsWith('http') 
          ? part.data 
          : `data:image/jpeg;base64,${part.data}`;
        return {
          type: 'image_url',
          image_url: { url: imageUrl }
        };
      }
      return { type: 'text', text: '' };
    });
    
    return { role, content } as OpenAI.Chat.ChatCompletionMessageParam;
  });
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
  
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    model,
    messages: normalizeMessages(messages),
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens,
    stream: false
  };
  
  if (options.tools && options.tools.length > 0) {
    params.tools = options.tools as OpenAI.Chat.ChatCompletionTool[];
  }
  
  try {
    const response = await client.chat.completions.create(params);
    const latencyMs = Date.now() - startTime;
    
    const message = response.choices[0]?.message;
    const text = message?.content || '';
    
    return {
      text,
      usage: {
        prompt_tokens: response.usage?.prompt_tokens || 0,
        completion_tokens: response.usage?.completion_tokens || 0,
        total_tokens: response.usage?.total_tokens || 0
      },
      latencyMs,
      raw: response,
      model: response.model
    };
  } catch (error: any) {
    throw new Error(`OpenAI error: ${error.message}`);
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
  
  const params: OpenAI.Chat.ChatCompletionCreateParams = {
    model,
    messages: normalizeMessages(messages),
    temperature: options.temperature ?? 0.2,
    max_tokens: options.max_tokens,
    stream: true
  };
  
  if (options.tools && options.tools.length > 0) {
    params.tools = options.tools as OpenAI.Chat.ChatCompletionTool[];
  }
  
  try {
    const stream = await client.chat.completions.create(params);
    
    let fullText = '';
    let promptTokens = 0;
    let completionTokens = 0;
    
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        yield delta;
      }
      
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens || 0;
        completionTokens = chunk.usage.completion_tokens || 0;
      }
    }
    
    const latencyMs = Date.now() - startTime;
    
    return {
      text: fullText,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      },
      latencyMs,
      model
    };
  } catch (error: any) {
    throw new Error(`OpenAI streaming error: ${error.message}`);
  }
}
