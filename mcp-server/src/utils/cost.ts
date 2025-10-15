interface ModelPricing {
  prompt: number;  // Cost per 1M tokens
  completion: number;  // Cost per 1M tokens
}

// Pricing table (approximate values, update with actual pricing)
// All prices are per 1M tokens in USD
const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI models
  'gpt-4o': { prompt: 2.50, completion: 10.00 },
  'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'gpt-4-turbo': { prompt: 10.00, completion: 30.00 },
  'gpt-4': { prompt: 30.00, completion: 60.00 },
  'gpt-3.5-turbo': { prompt: 0.50, completion: 1.50 },
  
  // Anthropic models
  'claude-3-5-sonnet-20241022': { prompt: 3.00, completion: 15.00 },
  'claude-3-opus-20240229': { prompt: 15.00, completion: 75.00 },
  'claude-3-sonnet-20240229': { prompt: 3.00, completion: 15.00 },
  'claude-3-haiku-20240307': { prompt: 0.25, completion: 1.25 },
  
  // Gemini models (approximate)
  'gemini-1.5-pro': { prompt: 1.25, completion: 5.00 },
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.30 },
  'gemini-pro': { prompt: 0.50, completion: 1.50 },
  
  // Grok models (estimated, update with actual pricing when available)
  'grok-beta': { prompt: 5.00, completion: 15.00 },
  'grok-2': { prompt: 5.00, completion: 15.00 }
};

export interface CostEstimate {
  prompt_cost: number;
  completion_cost: number;
  total_cost: number;
  currency: string;
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): CostEstimate | null {
  const pricing = PRICING_TABLE[model];
  
  if (!pricing) {
    // Return null if pricing is not available for this model
    return null;
  }
  
  const prompt_cost = (promptTokens / 1_000_000) * pricing.prompt;
  const completion_cost = (completionTokens / 1_000_000) * pricing.completion;
  const total_cost = prompt_cost + completion_cost;
  
  return {
    prompt_cost: parseFloat(prompt_cost.toFixed(6)),
    completion_cost: parseFloat(completion_cost.toFixed(6)),
    total_cost: parseFloat(total_cost.toFixed(6)),
    currency: 'USD'
  };
}

export function addPricing(model: string, pricing: ModelPricing): void {
  PRICING_TABLE[model] = pricing;
}

export function getPricing(model: string): ModelPricing | undefined {
  return PRICING_TABLE[model];
}

export function listAvailablePricing(): string[] {
  return Object.keys(PRICING_TABLE);
}
