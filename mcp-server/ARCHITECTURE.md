# Architecture - MCP Multimodal Server

## Vue d'ensemble

Ce serveur MCP (Model Context Protocol) unifie l'accès à plusieurs fournisseurs LLM via une API HTTP commune avec support du streaming SSE.

## Diagramme de l'architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client HTTP/SSE                          │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Fastify Server                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Routes:                                              │   │
│  │  - GET  /livez                                        │   │
│  │  - GET  /readyz                                       │   │
│  │  - GET  /mcp/tools                                    │   │
│  │  - POST /mcp/invoke                                   │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Tool Router                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ llm_generate │  │compare_models│  │ plan_execute │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   Provider Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  OpenAI  │  │ Anthropic│  │  Gemini  │  │   Grok   │    │
│  │          │  │  Claude  │  │          │  │   xAI    │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
└───────┼─────────────┼─────────────┼─────────────┼───────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────┐
│                  External LLM APIs                           │
│  - api.openai.com                                            │
│  - api.anthropic.com                                         │
│  - generativelanguage.googleapis.com                         │
│  - api.x.ai                                                  │
└─────────────────────────────────────────────────────────────┘
```

## Structure des dossiers

```
src/
├── index.ts              # Point d'entrée, bootstrap
├── server.ts             # Configuration Fastify, routes
├── config.ts             # Configuration et validation env
├── types.ts              # Définitions TypeScript communes
│
├── providers/            # Adaptateurs pour chaque LLM
│   ├── openai.ts        # Client OpenAI
│   ├── anthropic.ts     # Client Anthropic
│   ├── gemini.ts        # Client Google Gemini
│   └── grok.ts          # Client Grok (xAI)
│
├── tools/                # Implémentations MCP
│   ├── llmGenerate.ts   # Génération multimodale
│   ├── compareModels.ts # Comparaison de modèles
│   └── planExecute.ts   # Décomposition et exécution
│
├── schemas/              # Schémas Zod de validation
│   ├── llmGenerateSchema.ts
│   ├── compareSchema.ts
│   └── planSchema.ts
│
└── utils/                # Utilitaires
    ├── validators.ts    # Validation Zod
    ├── sse.ts          # Helpers SSE
    ├── usage.ts        # Tracking d'usage
    ├── cost.ts         # Estimation coûts
    └── router.ts       # Routage modalités
```

## Flux de données

### 1. Génération simple (llm_generate)

```
Client → POST /mcp/invoke
  ↓
Server: Validation Zod du payload
  ↓
Tool: llmGenerate.execute()
  ↓
Router: Vérification support modalité
  ↓
Provider: openai.generate() | anthropic.generate() | ...
  ↓
API externe: Appel HTTP
  ↓
Provider: Normalisation réponse
  ↓
Tool: Calcul coût, métriques
  ↓
Server: Retour JSON
  ↓
Client ← Response
```

### 2. Streaming SSE

```
Client → POST /mcp/invoke?stream=true
  ↓
Server: Set headers SSE
  ↓
Tool: llmGenerate.executeStream()
  ↓
Provider: openai.generateStream()
  ↓
Loop: for await (const chunk of stream)
  ↓
SSE: event: chunk, data: {...}
  ↓
Client ← Chunks en temps réel
  ↓
SSE: event: result, data: {...}
  ↓
SSE: event: done
  ↓
Connection fermée
```

### 3. Comparaison de modèles

```
Client → POST /mcp/invoke (compare_models)
  ↓
Tool: compareModels.execute()
  ↓
Promise.all([
  providerA.generate(...),
  providerB.generate(...)
])
  ↓
Calcul diff et scores
  ↓
Agrégation résultats + coûts
  ↓
Client ← {a: {...}, b: {...}, diff, scores, cost}
```

### 4. Planification structurée

```
Client → POST /mcp/invoke (plan_execute)
  ↓
Tool: planExecute.execute()
  ↓
Phase 1: Décomposition
  LLM décomposeur → Plan JSON structuré
  ↓
Phase 2: Exécution séquentielle
  For each step:
    - Mise à jour status: running
    - Exécution (llm_generate ou autre)
    - Stockage dans artifacts
    - status: done | error
  ↓
Phase 3: Résumé
  ↓
Client ← {plan: {...}, summary: "..."}
```

## Couches d'abstraction

### Couche 1 : HTTP (Fastify)
- Routage
- Validation requêtes
- Gestion erreurs
- Logging
- SSE

### Couche 2 : Tools (MCP)
- Logique métier
- Orchestration
- Validation Zod
- Métriques

### Couche 3 : Providers
- Normalisation messages
- Adaptation API spécifique
- Gestion streaming
- Extraction usage

### Couche 4 : Utils
- Helpers transverses
- Calculs coûts
- Routage modalités
- Formatage SSE

## Normalisation des messages

Chaque provider a sa propre structure de messages. Le serveur normalise :

```typescript
// Format interne
{
  role: 'user',
  content: [
    { type: 'text', data: '...' },
    { type: 'image', data: 'base64...' }
  ]
}

// → OpenAI
{
  role: 'user',
  content: [
    { type: 'text', text: '...' },
    { type: 'image_url', image_url: { url: 'data:...' } }
  ]
}

// → Anthropic
{
  role: 'user',
  content: [
    { type: 'text', text: '...' },
    { type: 'image', source: { type: 'base64', data: '...' } }
  ]
}

// → Gemini
{
  role: 'user',
  parts: [
    { text: '...' },
    { inlineData: { mimeType: 'image/jpeg', data: '...' } }
  ]
}
```

## Gestion des erreurs

### Hiérarchie
```
MCPError (interface de base)
├─ VALIDATION_ERROR    # Zod validation failed
├─ INVALID_TOOL        # Tool inconnu
├─ EXECUTION_ERROR     # Erreur pendant exécution
└─ INTERNAL_ERROR      # Erreur serveur
```

### Format standardisé
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

## Estimation des coûts

```typescript
// Table de prix (src/utils/cost.ts)
PRICING_TABLE = {
  'gpt-4o-mini': { prompt: 0.15, completion: 0.60 },
  'claude-3-5-sonnet': { prompt: 3.00, completion: 15.00 },
  ...
}

// Calcul
cost = (tokens / 1_000_000) * prix_par_million
```

**Note** : Les coûts sont estimatifs et peuvent varier.

## Logging et observabilité

### Logs structurés (Pino)
```json
{
  "level": "info",
  "time": 1697370000000,
  "reqId": "abc-123",
  "tool": "llm_generate",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "latencyMs": 342,
  "tokens": { "prompt": 15, "completion": 8, "total": 23 },
  "cost": { "total_cost": 0.000012 }
}
```

### Métriques trackées
- Latence par provider
- Usage tokens
- Coûts estimés
- Taux d'erreur
- Volume par outil

## Sécurité

### Au niveau serveur
- Validation stricte Zod
- Pas de logging des inputs sensibles
- Sanitization des erreurs en production
- Headers CORS désactivés par défaut

### Au niveau provider
- Clés API en variables d'environnement
- Pas de clés hardcodées
- Timeout sur requêtes
- Retry logic (à implémenter)

## Performance

### Optimisations
- Streaming pour réponses longues
- Exécution parallèle (compare_models)
- Connexions réutilisées (keep-alive)
- Pas de buffering pour SSE

### Limites actuelles
- Pas de cache
- Pas de rate limiting
- Pas de connection pooling
- Estimation tokens approximative

## Extensibilité

### Ajouter un nouveau provider

1. Créer `src/providers/newprovider.ts`
```typescript
export async function generate(model, messages, modality, opts) {
  // Implémenter
  return { text, usage, latencyMs };
}

export async function* generateStream(model, messages, modality, opts) {
  // Implémenter streaming
}
```

2. Mettre à jour `src/providers/` et importer dans les tools

3. Ajouter dans `PROVIDERS` map

4. Mettre à jour capabilities dans `router.ts`

### Ajouter un nouveau tool

1. Créer `src/tools/newTool.ts`
```typescript
export const definition = {
  name: 'new_tool',
  description: '...',
  input_schema: NewToolInput  // Zod schema
};

export async function execute(args, logger) {
  // Implémenter
  return result;
}
```

2. Créer schema dans `src/schemas/newToolSchema.ts`

3. Ajouter dans `TOOLS` map dans `server.ts`

## Tests

### Tests manuels
- Utiliser `test.http` avec REST Client
- cURL exemples dans README

### Tests automatisés (à implémenter)
```bash
npm test
```

## Déploiement

### Docker
```dockerfile
# Build multi-stage
FROM node:20-alpine AS builder
RUN npm ci && npm run build

FROM node:20-alpine
COPY --from=builder /app/dist ./dist
CMD ["node", "dist/index.js"]
```

### Variables d'environnement requises
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_API_KEY`
- `XAI_API_KEY`
- `PORT` (optionnel, défaut: 8080)
- `LOG_LEVEL` (optionnel, défaut: info)

## Monitoring production

### Health checks
- `/livez` : Liveness probe
- `/readyz` : Readiness probe (vérifie API keys)

### Métriques à tracker
- Requêtes par seconde
- Latence p50, p95, p99
- Taux d'erreur
- Coûts cumulés
- Usage par provider

## Limites connues

1. **Tokenisation** : Estimation approximative (~4 chars/token)
2. **Coûts** : Prix indicatifs, à vérifier avec factures
3. **Streaming** : Uniquement pour `llm_generate`
4. **Multimodal** : Support variable selon provider
5. **Rate limiting** : Non implémenté
6. **Authentification** : Non implémenté

## Roadmap

- [ ] Cache Redis pour réponses
- [ ] Rate limiting par IP/clé
- [ ] Authentification JWT
- [ ] Métriques Prometheus
- [ ] Tests unitaires et e2e
- [ ] Support WebSockets
- [ ] Batch requests
- [ ] Retry avec backoff exponentiel
