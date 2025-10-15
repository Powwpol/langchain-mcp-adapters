// Provider types
export type Provider = 'openai' | 'anthropic' | 'gemini' | 'grok';
export type Modality = 'text' | 'vision' | 'image' | 'audio';
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

// Message structures
export interface MessageContent {
  type: 'text' | 'image' | 'audio';
  data: string;
}

export interface Message {
  role: MessageRole;
  content: string | MessageContent[];
}

// Provider response
export interface ProviderResponse {
  text: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latencyMs: number;
  raw?: any;
  model?: string;
}

// Tool definitions
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, any>;
}

// Error response
export interface MCPError {
  code: string;
  message: string;
  details?: any;
}

// Provider configuration
export interface ProviderConfig {
  apiKey: string;
  baseURL?: string;
}

// Cost estimation
export interface CostEstimate {
  prompt_cost: number;
  completion_cost: number;
  total_cost: number;
  currency: string;
}

// SSE event types
export interface ChunkEvent {
  id: string;
  provider: Provider;
  model: string;
  delta: string;
}

export interface ResultEvent {
  id: string;
  output: any;
}

export interface ErrorEvent {
  id: string;
  message: string;
  code?: string;
}

// Tool invocation
export interface ToolInvocation {
  tool: string;
  arguments: Record<string, any>;
  stream?: boolean;
}

// Plan execution types
export type StepStatus = 'pending' | 'running' | 'done' | 'error';
export type ToolType = 'llm_generate' | 'call_function' | 'search' | 'fetch' | string;

export interface PlanStep {
  id: string;
  goal: string;
  inputs: Record<string, any>;
  tool: ToolType;
  status: StepStatus;
  result_ref?: string;
  parent_id?: string;
}

export interface PlanArtifact {
  type: 'text' | 'json' | 'file';
  value: any;
}

export interface Plan {
  id: string;
  created_at: string;
  steps: PlanStep[];
  artifacts: Record<string, PlanArtifact>;
}
