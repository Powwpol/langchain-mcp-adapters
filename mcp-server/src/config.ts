import dotenv from 'dotenv';
import { ProviderConfig } from './types.js';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  
  providers: {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      baseURL: process.env.OPENAI_BASE_URL
    } as ProviderConfig,
    
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    } as ProviderConfig,
    
    gemini: {
      apiKey: process.env.GOOGLE_API_KEY || ''
    } as ProviderConfig,
    
    grok: {
      apiKey: process.env.XAI_API_KEY || '',
      baseURL: process.env.GROK_BASE_URL || 'https://api.x.ai/v1'
    } as ProviderConfig
  }
};

export function validateConfig(): void {
  const errors: string[] = [];
  
  if (!config.providers.openai.apiKey) {
    errors.push('OPENAI_API_KEY is not set');
  }
  
  if (!config.providers.anthropic.apiKey) {
    errors.push('ANTHROPIC_API_KEY is not set');
  }
  
  if (!config.providers.gemini.apiKey) {
    errors.push('GOOGLE_API_KEY is not set');
  }
  
  if (!config.providers.grok.apiKey) {
    errors.push('XAI_API_KEY is not set');
  }
  
  if (errors.length > 0) {
    console.warn('Warning: Some API keys are missing:', errors.join(', '));
    console.warn('Some providers will not be available.');
  }
}
