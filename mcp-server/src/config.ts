import pino from 'pino';

export type AppConfig = {
  port: number;
  openaiApiKey?: string;
  openaiBaseUrl?: string;
  anthropicApiKey?: string;
  googleApiKey?: string;
  xaiApiKey?: string;
  grokBaseUrl?: string;
  logger: pino.LoggerOptions | boolean;
};

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 8080);
  const config: AppConfig = {
    port,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiBaseUrl: process.env.OPENAI_BASE_URL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    xaiApiKey: process.env.XAI_API_KEY,
    grokBaseUrl: process.env.GROK_BASE_URL ?? 'https://api.x.ai/v1',
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      base: undefined,
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
      },
    },
  };
  return config;
}
