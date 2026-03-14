// Backward-compatible shim while the app transitions from Deepgram to ElevenLabs.
export {
  ElevenLabsClient as DeepgramClient,
  ElevenLabsConnectionState as DeepgramConnectionState,
  connectElevenLabs as connectDeepgram,
  getElevenLabsApiKey as getDeepgramApiKey,
  isElevenLabsConfigured as isDeepgramConfigured,
} from './elevenLabs';

export const DEFAULT_DEEPGRAM_CONFIG = {
  model: 'scribe_v2_realtime',
  multichannel: false,
  smart_format: true,
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
} as const;
