// Where the speech-to-text (STT) and speech/memory/tools (TTS) servers are.
//
// Set VITE_TTS_URL / VITE_STT_URL to a full URL (for example http://my-server:8766),
// or VITE_TTS_PORT / VITE_STT_PORT to change only the port. With nothing set, the
// servers are taken to be on the same host as the page, so opening the app from a
// laptop on a server reaches the servers on that server. A page with no host
// (Electron's file:// page) falls back to localhost, which is also the local-dev default.

export const DEFAULT_TTS_PORT = 8766;
export const DEFAULT_STT_PORT = 8765;

export function serviceUrl(service, env = import.meta.env, location = globalThis.window?.location) {
  const isTts = service === 'tts';
  const explicit = isTts ? env.VITE_TTS_URL : env.VITE_STT_URL;
  if (explicit) return String(explicit).replace(/\/+$/, '');
  const port = (isTts ? env.VITE_TTS_PORT : env.VITE_STT_PORT) || (isTts ? DEFAULT_TTS_PORT : DEFAULT_STT_PORT);
  const host = location?.hostname || 'localhost';
  return `http://${host}:${port}`;
}
