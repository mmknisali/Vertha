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

export async function getSttUrl() {
  if (typeof window !== 'undefined' && window.vertha && window.vertha.sttUrl) {
    return window.vertha.sttUrl;
  }
  return DEV_DEFAULTS.sttUrl;
}

export async function getTtsUrl() {
  if (typeof window !== 'undefined' && window.vertha && window.vertha.ttsUrl) {
    return window.vertha.ttsUrl;
  }
  return DEV_DEFAULTS.ttsUrl;
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