/**
 * Manual 16-bit little-endian PCM encoding/decoding helpers for Gemini Live API.
 * Input audio must be 16kHz PCM16; model output audio is 24kHz PCM16.
 */

export function float32ToBase64Pcm16(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < float32.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    const sample = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(i * 2, sample, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const sub = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

export function decodeBase64Pcm16ToAudioBuffer(
  ctx: AudioContext,
  base64: string,
  sampleRate = 24000
): AudioBuffer | null {
  if (!base64) return null;
  const binary = atob(base64);
  const byteLength = binary.length;
  const sampleCount = Math.floor(byteLength / 2);
  if (sampleCount <= 0) return null;

  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const audioBuffer = ctx.createBuffer(1, sampleCount, sampleRate);
  const channelData = audioBuffer.getChannelData(0);
  const view = new DataView(bytes.buffer);

  for (let i = 0; i < sampleCount; i += 1) {
    channelData[i] = view.getInt16(i * 2, true) / 32768;
  }

  return audioBuffer;
}
