const DEV_DEFAULTS = {
  ttsUrl: 'http://localhost:8766',
  sttUrl: 'http://localhost:8765',
  zenApiKey: '',
  groqApiKey: '',
  locationLat: '37.0662',
  locationLon: '37.3833',
  podcastShowUri: '',
};

let cachedConfig = null;
let configPromise = null;

export async function getConfig() {
  if (typeof window !== 'undefined' && window.vertha) {
    if (!configPromise) {
      configPromise = window.vertha.getConfig().then(config => {
        cachedConfig = config;
        return config;
      });
    }
    return configPromise;
  }

  return DEV_DEFAULTS;
}

async function getUrls() {
  if (typeof window !== 'undefined' && window.vertha && window.vertha.getUrls) {
    return window.vertha.getUrls();
  }
  return null;
}

export async function getSttUrl() {
  const urls = await getUrls();
  return (urls && urls.sttUrl) || DEV_DEFAULTS.sttUrl;
}

export async function getTtsUrl() {
  const urls = await getUrls();
  return (urls && urls.ttsUrl) || DEV_DEFAULTS.ttsUrl;
}

export async function saveConfig(config) {
  if (typeof window !== 'undefined' && window.vertha) {
    return window.vertha.saveConfig(config);
  }
  cachedConfig = config;
  return config;
}

export function isElectron() {
  return typeof window !== 'undefined' && window.vertha;
}