export type ProviderName = 'openai' | 'anthropic' | 'gemini' | 'grok';
export type Modality = 'text' | 'vision' | 'image' | 'audio';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type Message = {
  role: Role;
  content: unknown; // string or structured multimodal parts
};

export type Usage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type ProviderCallParams = {
  provider: ProviderName;
  model: string;
  modality: Modality;
  messages: Message[];
  inputs?: { image?: string; audio?: string };
  opts?: { temperature?: number; max_tokens?: number; tools?: unknown[] };
  stream?: boolean;
  onChunk?: (delta: string) => void;
};

export type ProviderResult = {
  text?: string;
  json?: unknown;
  usage?: Usage;
  latencyMs: number;
  raw?: unknown;
};

export type ToolDescriptor = {
  name: string;
  description: string;
  input_schema: unknown; // JSON Schema
};

export type StandardError = {
  code: string;
  message: string;
  details?: unknown;
};

export type SseChunkEvent = { id: string; provider?: ProviderName; model?: string; delta: string };
export type SseResultEvent = { id: string; output: unknown };
export type SseErrorEvent = { id: string; message: string };
