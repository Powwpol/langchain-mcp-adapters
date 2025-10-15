import { z, ZodSchema } from 'zod';
import { MCPError } from '../types.js';

export function validateInput(
  schema: ZodSchema<any>,
  data: unknown
): any {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw createValidationError(error);
    }
    throw error;
  }
}

export function createValidationError(error: z.ZodError): MCPError {
  const details = error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
  
  return {
    code: 'VALIDATION_ERROR',
    message: 'Input validation failed',
    details
  };
}

export function createError(
  code: string,
  message: string,
  details?: any
): MCPError {
  return { code, message, details };
}

export function isValidProvider(provider: string): boolean {
  return ['openai', 'anthropic', 'gemini', 'grok'].includes(provider);
}

export function isValidModality(modality: string): boolean {
  return ['text', 'vision', 'image', 'audio'].includes(modality);
}

export function sanitizeErrorMessage(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

export function normalizeMessages(messages: any[]): any[] {
  return messages.map(msg => {
    if (typeof msg === 'string') {
      return { role: 'user', content: msg };
    }
    return msg;
  });
}
