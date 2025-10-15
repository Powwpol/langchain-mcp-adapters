# MCP Multimodal LLM Server

A unified Model Context Protocol (MCP) server that aggregates multiple LLM providers (OpenAI, Anthropic, Gemini, Grok) with support for text, vision, image, and audio modalities.

## Features

- **Multi-Provider Support**: OpenAI, Anthropic Claude, Google Gemini, and xAI Grok
- **Multimodal Capabilities**: Text, vision, image, and audio processing
- **Structured Planning**: Decompose complex goals into structured execution plans (no free-form reasoning)
- **Model Comparison**: Side-by-side comparison of different models
- **Streaming Support**: Server-Sent Events (SSE) for real-time responses
- **Cost Estimation**: Track and estimate API costs
- **Type-Safe**: Built with TypeScript and Zod validation

## Architecture

```
mcp-server/
├── src/
│   ├── providers/       # LLM provider implementations
│   ├── tools/           # MCP tools (llm_generate, compare_models, plan_execute)
│   ├── schemas/         # Zod schemas for validation
│   ├── utils/           # Utilities (SSE, cost estimation, etc.)
│   ├── server.ts        # Fastify server setup
│   ├── config.ts        # Configuration and validation
│   └── index.ts         # Entry point
├── Dockerfile
└── package.json
```

## Installation

### Prerequisites

- Node.js 20+
- npm or yarn

### Setup

1. **Clone and install dependencies:**

```bash
cd mcp-server
npm install
```

2. **Configure environment variables:**

```bash
cp .env.example .env
```

Edit `.env` with your API keys:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
XAI_API_KEY=...
GROK_BASE_URL=https://api.x.ai/v1
PORT=8080
LOG_LEVEL=info
```

3. **Run in development:**

```bash
npm run dev
```

4. **Build for production:**

```bash
npm run build
npm start
```

## Docker

### Build and run:

```bash
docker build -t mcp-multimodal-server .
docker run -p 8080:8080 --env-file .env mcp-multimodal-server
```

### Using Docker Compose:

```yaml
version: '3.8'
services:
  mcp-server:
    build: .
    ports:
      - "8080:8080"
    env_file:
      - .env
    restart: unless-stopped
```

## API Endpoints

### Health Checks

```bash
# Liveness probe
curl http://localhost:8080/livez

# Readiness probe (shows provider status)
curl http://localhost:8080/readyz
```

### List Available Tools

```bash
curl http://localhost:8080/mcp/tools | jq
```

Response:
```json
{
  "tools": [
    {
      "name": "llm_generate",
      "description": "Generate text, vision, image, or audio using various LLM providers",
      "input_schema": { ... }
    },
    {
      "name": "compare_models",
      "description": "Compare responses from two different LLM models side-by-side",
      "input_schema": { ... }
    },
    {
      "name": "plan_execute",
      "description": "Decompose a goal into structured steps and execute them",
      "input_schema": { ... }
    }
  ]
}
```

### Invoke Tools

#### 1. Generate Text (llm_generate)

**Basic text generation:**

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "llm_generate",
    "arguments": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "messages": [
        {"role": "user", "content": "What is the capital of France?"}
      ]
    }
  }' | jq
```

Response:
```json
{
  "text": "The capital of France is Paris.",
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 8,
    "total_tokens": 23
  },
  "latencyMs": 342,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "cost": 0.000012
}
```

**Vision/multimodal example:**

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "llm_generate",
    "arguments": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "modality": "vision",
      "messages": [
        {
          "role": "user",
          "content": [
            {"type": "text", "data": "What is in this image?"},
            {"type": "image", "data": "data:image/jpeg;base64,/9j/4AAQ..."}
          ]
        }
      ]
    }
  }' | jq
```

**Streaming (SSE):**

```bash
curl -X POST "http://localhost:8080/mcp/invoke?stream=true" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "llm_generate",
    "arguments": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "messages": [
        {"role": "user", "content": "Write a short poem about coding"}
      ]
    }
  }'
```

SSE Events:
```
event: chunk
data: {"id":"abc-123","provider":"openai","model":"gpt-4o-mini","delta":"In"}

event: chunk
data: {"id":"abc-123","provider":"openai","model":"gpt-4o-mini","delta":" lines"}

event: result
data: {"id":"abc-123","output":{...}}

event: done
data: {"status":"completed"}
```

#### 2. Compare Models (compare_models)

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "compare_models",
    "arguments": {
      "prompt": "Explain quantum computing in simple terms",
      "a": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      },
      "b": {
        "provider": "anthropic",
        "model": "claude-3-haiku-20240307"
      },
      "opts": {
        "temperature": 0.3,
        "max_tokens": 200
      }
    }
  }' | jq
```

Response:
```json
{
  "a": {
    "text": "Quantum computing uses quantum mechanics principles...",
    "usage": {
      "prompt_tokens": 12,
      "completion_tokens": 95,
      "total_tokens": 107
    },
    "latencyMs": 1234
  },
  "b": {
    "text": "Quantum computers are fundamentally different from...",
    "usage": {
      "prompt_tokens": 12,
      "completion_tokens": 102,
      "total_tokens": 114
    },
    "latencyMs": 987
  },
  "diff": "Length difference: 28 characters (5.2%). Model A: 512 chars, Model B: 540 chars.",
  "scores": {
    "relevance": 0.85,
    "consistency": 0.72
  },
  "cost": 0.000234
}
```

#### 3. Plan and Execute (plan_execute)

**Structured task decomposition:**

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "plan_execute",
    "arguments": {
      "goal": "Research and summarize the latest developments in renewable energy",
      "constraints": ["Keep each step under 100 tokens", "Focus on solar and wind"],
      "tools_allowed": ["llm_generate", "search"],
      "decomposer": {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-20241022"
      },
      "opts": {
        "max_depth": 3
      }
    }
  }' | jq
```

Response (structured plan, no free-form reasoning):
```json
{
  "plan": {
    "id": "plan-abc-123",
    "created_at": "2025-10-15T10:30:00.000Z",
    "steps": [
      {
        "id": "step-1",
        "goal": "Identify key renewable energy developments",
        "inputs": {},
        "tool": "llm_generate",
        "status": "done",
        "result_ref": "artifact-step-1"
      },
      {
        "id": "step-2",
        "goal": "Summarize solar energy advancements",
        "inputs": {},
        "tool": "llm_generate",
        "status": "done",
        "result_ref": "artifact-step-2"
      },
      {
        "id": "step-3",
        "goal": "Summarize wind energy advancements",
        "inputs": {},
        "tool": "llm_generate",
        "status": "done",
        "result_ref": "artifact-step-3"
      }
    ],
    "artifacts": {
      "artifact-step-1": {
        "type": "json",
        "value": { "text": "Recent developments include...", "usage": {...} }
      },
      "artifact-step-2": {
        "type": "json",
        "value": { "text": "Solar: Perovskite cells...", "usage": {...} }
      },
      "artifact-step-3": {
        "type": "json",
        "value": { "text": "Wind: Offshore turbines...", "usage": {...} }
      }
    }
  },
  "summary": "Plan execution completed. 3/3 steps succeeded, 0 failed. Goal: \"Research and summarize the latest developments in renewable energy\""
}
```

## Tools Reference

### llm_generate

Generate text or multimodal content using any supported provider.

**Input Schema:**
- `provider`: `'openai' | 'anthropic' | 'gemini' | 'grok'`
- `model`: Model identifier (e.g., `'gpt-4o-mini'`, `'claude-3-5-sonnet-20241022'`)
- `modality`: `'text' | 'vision' | 'image' | 'audio'` (default: `'text'`)
- `messages`: Array of message objects
- `inputs`: Optional image/audio data (base64 or URL)
- `opts`: Generation options (temperature, max_tokens, tools, stream)

### compare_models

Compare two models on the same input.

**Input Schema:**
- `prompt`: Simple text prompt OR
- `messages`: Structured messages
- `a`: First model `{provider, model}`
- `b`: Second model `{provider, model}`
- `opts`: Generation options

**Output:** Side-by-side comparison with diff and heuristic scores.

### plan_execute

Decompose a goal into structured steps and execute them.

**Input Schema:**
- `goal`: Main objective (string)
- `constraints`: Array of constraints
- `tools_allowed`: Array of allowed tool names
- `decomposer`: LLM to use for decomposition `{provider, model}`
- `opts`: Options including `max_depth`

**Output:** Structured plan with steps, status, and artifacts. No free-form reasoning chains.

## Provider Support Matrix

| Provider  | Text | Vision | Image | Audio | Streaming |
|-----------|------|--------|-------|-------|-----------|
| OpenAI    | ✅   | ✅     | ✅*   | ✅*   | ✅        |
| Anthropic | ✅   | ✅     | ❌    | ❌    | ✅        |
| Gemini    | ✅   | ✅     | ❌    | ❌    | ✅        |
| Grok      | ✅   | ❌**   | ❌    | ❌    | ✅        |

*Via separate APIs (DALL-E, Whisper, TTS)
**May be added in future

## Cost Estimation

The server includes approximate cost estimation based on token usage. Prices are configured in `src/utils/cost.ts`.

**Note:** Costs are estimates and may not reflect exact billing. Always verify with provider invoices.

## Error Handling

All errors follow the MCP error format:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Input validation failed",
  "details": [
    {
      "path": "arguments.provider",
      "message": "Invalid enum value",
      "code": "invalid_enum_value"
    }
  ]
}
```

Common error codes:
- `VALIDATION_ERROR`: Invalid input
- `INVALID_TOOL`: Unknown tool name
- `EXECUTION_ERROR`: Tool execution failed
- `INTERNAL_ERROR`: Server error

## Limitations

1. **Token Estimation**: For providers that don't return token counts, we use character-based estimation (~4 chars/token)
2. **Cost Accuracy**: Pricing is approximate and should be verified against actual invoices
3. **Streaming**: Only available for `llm_generate` tool
4. **Modality Support**: Varies by provider (see matrix above)

## Development

### Running tests:

```bash
npm test
```

### Linting:

```bash
npm run lint
```

### Type checking:

```bash
npx tsc --noEmit
```

## Contributing

Contributions are welcome! Please ensure:
- All code is type-safe
- Input validation with Zod
- Proper error handling
- No free-form reasoning in plan outputs (structured JSON only)

## License

MIT

## Support

For issues and questions, please open an issue on the repository.

---

**Example `.http` file for testing (VS Code REST Client):**

```http
### Health check
GET http://localhost:8080/livez

### List tools
GET http://localhost:8080/mcp/tools

### Generate text
POST http://localhost:8080/mcp/invoke
Content-Type: application/json

{
  "tool": "llm_generate",
  "arguments": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }
}

### Compare models
POST http://localhost:8080/mcp/invoke
Content-Type: application/json

{
  "tool": "compare_models",
  "arguments": {
    "prompt": "What is machine learning?",
    "a": {"provider": "openai", "model": "gpt-4o-mini"},
    "b": {"provider": "anthropic", "model": "claude-3-haiku-20240307"}
  }
}

### Plan execution
POST http://localhost:8080/mcp/invoke
Content-Type: application/json

{
  "tool": "plan_execute",
  "arguments": {
    "goal": "Analyze climate change impact",
    "decomposer": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022"
    }
  }
}
```
