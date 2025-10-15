## MCP Server (Node.js + TypeScript)

Aggregates OpenAI, Anthropic, Gemini, and Grok (xAI) behind a simple HTTP interface exposing MCP tools with optional Server-Sent Events (SSE) streaming.

### Features
- Text and limited vision support (provider-dependent)
- Tools: `llm_generate`, `compare_models`, `plan_execute`
- Structured plan JSON (no chain-of-thought)
- Fastify + `@fastify/sse-v2`, Zod validation, JSON Schema exposure

### Install
```bash
npm ci
npm run build
npm start
# or during development
npm run dev
```

### Environment
Copy `.env.example` to `.env` and fill keys:
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `GROK_BASE_URL` (default `https://api.x.ai/v1`)
- `OPENAI_BASE_URL` (optional)
- `PORT` (default `8080`)

### Endpoints
- GET `/livez` – health
- GET `/mcp/tools` – list tools with JSON Schemas
- POST `/mcp/invoke` – invoke a tool with `{ tool, arguments }`
  - Query `?stream=true` to stream via SSE

### SSE Event format
- `chunk` – `{ id, provider, model, delta }`
- `result` – `{ id, output }`
- `error` – `{ id, message }`

### Examples

List tools:
```bash
curl -s http://localhost:8080/mcp/tools | jq
```

Call `llm_generate` (text):
```bash
curl -sX POST http://localhost:8080/mcp/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "tool":"llm_generate",
    "arguments":{
      "provider":"openai",
      "model":"gpt-4o-mini",
      "modality":"text",
      "messages":[{"role":"user","content":"Say hello"}]
    }
  }' | jq
```

Compare two models:
```bash
curl -sX POST http://localhost:8080/mcp/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "tool":"compare_models",
    "arguments":{
      "prompt":"Write a haiku about the ocean",
      "a":{"provider":"openai","model":"gpt-4o-mini"},
      "b":{"provider":"grok","model":"grok-beta"}
    }
  }' | jq
```

Streaming (SSE):
```bash
curl -N -s "http://localhost:8080/mcp/invoke?stream=true" \
  -H 'Content-Type: application/json' \
  -d '{
    "tool":"llm_generate",
    "arguments":{
      "provider":"openai",
      "model":"gpt-4o-mini",
      "modality":"text",
      "messages":[{"role":"user","content":"Stream a poem"}]
    }
  }'
```

Plan and execute:
```bash
curl -sX POST http://localhost:8080/mcp/invoke \
  -H 'Content-Type: application/json' \
  -d '{
    "tool":"plan_execute",
    "arguments":{
      "goal":"Summarize this project",
      "constraints":[],
      "tools_allowed":["llm_generate"],
      "decomposer":{"provider":"openai","model":"gpt-4o-mini"}
    }
  }' | jq
```

### Notes
- Token usage estimation is approximate; costs are indicative only.
- Streaming support varies by provider; Grok/OpenAI stream via Chat Completions.
- No chain-of-thought is ever returned; plan outputs are structured JSON.
