import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '../config.js';
import { Message, ProviderResponse, Modality } from '../types.js';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(config.providers.gemini.apiKey);
  }
  return genAI;
}

function normalizeMessages(messages: Message[]) {
  const systemMessage = messages.find(msg => msg.role === 'system');
  const conversationMessages = messages.filter(msg => msg.role !== 'system');
  
  const contents = conversationMessages.map(msg => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    
    if (typeof msg.content === 'string') {
      return {
        role,
        parts: [{ text: msg.content }]
      };
    }
    
    // Handle multimodal content
    const parts = msg.content.map(part => {
      if (part.type === 'text') {
        return { text: part.data };
      } else if (part.type === 'image') {
        // Gemini expects base64 without data URI prefix
        const base64Data = part.data.replace(/^data:image\/[a-z]+;base64,/, '');
        return {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        };
      }
      return { text: '' };
    });
    
    return { role, parts };
  });
  
  return { contents, systemInstruction: systemMessage?.content as string | undefined };
}

function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
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
  
  const generativeModel: GenerativeModel = client.getGenerativeModel({
    model,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.max_tokens
    }
  });
  
  try {
    const { contents, systemInstruction } = normalizeMessages(messages);
    
    const chat = generativeModel.startChat({
      history: contents.slice(0, -1),
      systemInstruction
    });
    
    const lastMessage = contents[contents.length - 1];
    const result = await chat.sendMessage(lastMessage.parts);
    
    const latencyMs = Date.now() - startTime;
    const text = result.response.text();
    
    // Gemini doesn't always provide token counts, estimate them
    const promptText = messages.map(m => 
      typeof m.content === 'string' ? m.content : ''
    ).join(' ');
    
    const promptTokens = result.response.usageMetadata?.promptTokenCount || estimateTokens(promptText);
    const completionTokens = result.response.usageMetadata?.candidatesTokenCount || estimateTokens(text);
    
    return {
      text,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: promptTokens + completionTokens
      },
      latencyMs,
      raw: result.response,
      model
    };
  } catch (error: any) {
    throw new Error(`Gemini error: ${error.message}`);
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
  
  const generativeModel: GenerativeModel = client.getGenerativeModel({
    model,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.max_tokens
    }
  });
  
  try {
    const { contents, systemInstruction } = normalizeMessages(messages);
    
    const chat = generativeModel.startChat({
      history: contents.slice(0, -1),
      systemInstruction
    });
    
    const lastMessage = contents[contents.length - 1];
    const result = await chat.sendMessageStream(lastMessage.parts);
    
    let fullText = '';
    let promptTokens = 0;
    let completionTokens = 0;
    
    for await (const chunk of result.stream) {
      const delta = chunk.text();
      fullText += delta;
      yield delta;
    }
    
    const finalResponse = await result.response;
    const latencyMs = Date.now() - startTime;
    
    const promptText = messages.map(m => 
      typeof m.content === 'string' ? m.content : ''
    ).join(' ');
    
    promptTokens = finalResponse.usageMetadata?.promptTokenCount || estimateTokens(promptText);
    completionTokens = finalResponse.usageMetadata?.candidatesTokenCount || estimateTokens(fullText);
    
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
    throw new Error(`Gemini streaming error: ${error.message}`);
  }
}
