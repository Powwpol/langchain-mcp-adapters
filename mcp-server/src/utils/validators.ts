import { ZodSchema } from 'zod';
import { StandardError } from '../types.js';

export function parseWithZod<T>(schema: ZodSchema<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message }));
    const err: StandardError = { code: 'VALIDATION_ERROR', message: 'Invalid input', details: issues };
    throw err;
  }
  return parsed.data;
}
