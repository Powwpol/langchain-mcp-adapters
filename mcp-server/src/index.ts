#!/usr/bin/env node

import { startServer } from './server.js';
import { validateConfig } from './config.js';

async function main() {
  console.log('🚀 Starting MCP Multimodal Server...');
  
  // Validate configuration
  validateConfig();
  
  // Start server
  const server = await startServer();
  
  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`);
    
    try {
      await server.close();
      console.log('Server closed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };
  
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
