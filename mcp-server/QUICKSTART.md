# Quick Start Guide - MCP Multimodal Server

## 🚀 Installation rapide

### 1. Configuration de l'environnement

```bash
cd mcp-server
cp .env.example .env
```

Éditez `.env` avec vos clés API :
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
XAI_API_KEY=...
GROK_BASE_URL=https://api.x.ai/v1
PORT=8080
LOG_LEVEL=info
```

### 2. Démarrage en développement

```bash
npm install
npm run dev
```

Le serveur sera accessible sur `http://localhost:8080`

### 3. Build pour production

```bash
npm run build
npm start
```

### 4. Docker

```bash
# Build
docker build -t mcp-server .

# Run
docker run -p 8080:8080 --env-file .env mcp-server

# Ou avec Docker Compose
docker-compose up
```

## 📋 Test rapide

### Vérifier que le serveur fonctionne

```bash
curl http://localhost:8080/livez
# {"status":"ok","timestamp":"..."}
```

### Lister les outils disponibles

```bash
curl http://localhost:8080/mcp/tools | jq
```

### Générer du texte avec OpenAI

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "llm_generate",
    "arguments": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "messages": [
        {"role": "user", "content": "Hello, how are you?"}
      ]
    }
  }' | jq
```

### Comparer deux modèles

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "compare_models",
    "arguments": {
      "prompt": "What is artificial intelligence?",
      "a": {"provider": "openai", "model": "gpt-4o-mini"},
      "b": {"provider": "anthropic", "model": "claude-3-haiku-20240307"}
    }
  }' | jq
```

### Planifier et exécuter une tâche

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "plan_execute",
    "arguments": {
      "goal": "Explain climate change in 3 points",
      "decomposer": {
        "provider": "anthropic",
        "model": "claude-3-5-sonnet-20241022"
      }
    }
  }' | jq
```

### Streaming SSE

```bash
curl -X POST "http://localhost:8080/mcp/invoke?stream=true" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "llm_generate",
    "arguments": {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "messages": [
        {"role": "user", "content": "Write a haiku about coding"}
      ]
    }
  }'
```

## 🛠️ Outils disponibles

### 1. `llm_generate`
Génère du texte, vision, image ou audio avec n'importe quel provider.

**Providers supportés** :
- OpenAI (text, vision, image, audio)
- Anthropic (text, vision)
- Gemini (text, vision)
- Grok (text)

### 2. `compare_models`
Compare deux modèles côte à côte sur le même prompt.

### 3. `plan_execute`
Décompose un objectif en étapes structurées et les exécute.

**Note** : Retourne un plan JSON structuré sans chaîne de pensée libre.

## 📝 Fichiers de test

Utilisez le fichier `test.http` avec l'extension REST Client de VS Code pour tester facilement tous les endpoints.

## 🐛 Dépannage

### Le serveur ne démarre pas
```bash
# Vérifier les logs
npm run dev

# Vérifier que les ports sont disponibles
lsof -i :8080
```

### Erreurs d'API key
```bash
# Vérifier que les clés sont bien chargées
cat .env

# Vérifier le statut des providers
curl http://localhost:8080/readyz | jq
```

### Problèmes de build
```bash
# Nettoyer et rebuilder
rm -rf dist node_modules
npm install
npm run build
```

## 📊 Monitoring

Les logs incluent automatiquement :
- Usage de tokens
- Latence des requêtes
- Estimation des coûts
- Erreurs détaillées

Exemple de log :
```json
{
  "level": "info",
  "tool": "llm_generate",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "latencyMs": 342,
  "tokens": {
    "prompt": 15,
    "completion": 8,
    "total": 23
  },
  "cost": {
    "total_cost": 0.000012,
    "currency": "USD"
  }
}
```

## 🔒 Sécurité

- Ne jamais commiter le fichier `.env`
- Les clés API ne sont jamais loguées
- Utiliser HTTPS en production
- Implémenter l'authentification si exposé publiquement

## 📚 Documentation complète

Voir [README.md](./README.md) pour la documentation complète.

## 🎯 Prochaines étapes

1. **Tests de charge** : Tester avec des volumes importants
2. **Rate limiting** : Ajouter des limites par IP/clé
3. **Cache** : Implémenter un cache Redis pour les réponses
4. **Métriques** : Ajouter Prometheus/Grafana
5. **Authentication** : JWT ou API keys

## 💡 Exemples avancés

### Vision avec Anthropic

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "llm_generate",
    "arguments": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-20241022",
      "modality": "vision",
      "messages": [{
        "role": "user",
        "content": [
          {"type": "text", "data": "Describe this image"},
          {"type": "image", "data": "https://example.com/image.jpg"}
        ]
      }]
    }
  }' | jq
```

### Plan complexe

```bash
curl -X POST http://localhost:8080/mcp/invoke \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "plan_execute",
    "arguments": {
      "goal": "Research and summarize AI trends in 2024",
      "constraints": [
        "Focus on healthcare and education",
        "Maximum 100 tokens per step"
      ],
      "tools_allowed": ["llm_generate", "search"],
      "decomposer": {
        "provider": "openai",
        "model": "gpt-4o-mini"
      },
      "opts": {
        "max_depth": 5
      }
    }
  }' | jq '.plan.steps'
```

## 🤝 Support

Pour des questions ou des problèmes, consultez :
- La documentation dans `README.md`
- Les exemples dans `test.http`
- Les logs du serveur pour le debugging
