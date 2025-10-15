import { Provider, Modality } from '../types.js';

interface ProviderCapabilities {
  text: boolean;
  vision: boolean;
  image: boolean;
  audio: boolean;
}

const PROVIDER_CAPABILITIES: Record<Provider, ProviderCapabilities> = {
  openai: {
    text: true,
    vision: true,
    image: true,  // via DALL-E integration
    audio: true   // via Whisper/TTS
  },
  anthropic: {
    text: true,
    vision: true,
    image: false,
    audio: false
  },
  gemini: {
    text: true,
    vision: true,
    image: false,
    audio: false
  },
  grok: {
    text: true,
    vision: false,  // May support vision in future
    image: false,
    audio: false
  }
};

export function supportsModality(provider: Provider, modality: Modality): boolean {
  const capabilities = PROVIDER_CAPABILITIES[provider];
  return capabilities[modality] || false;
}

export function getCapabilities(provider: Provider): ProviderCapabilities {
  return PROVIDER_CAPABILITIES[provider];
}

export function findSupportedProviders(modality: Modality): Provider[] {
  return (Object.keys(PROVIDER_CAPABILITIES) as Provider[]).filter(
    provider => supportsModality(provider, modality)
  );
}

export function validateProviderModality(
  provider: Provider,
  modality: Modality
): void {
  if (!supportsModality(provider, modality)) {
    throw new Error(
      `Provider '${provider}' does not support modality '${modality}'. ` +
      `Supported modalities: ${Object.entries(PROVIDER_CAPABILITIES[provider])
        .filter(([_, supported]) => supported)
        .map(([mod]) => mod)
        .join(', ')}`
    );
  }
}
