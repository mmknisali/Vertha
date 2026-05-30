const { contextBridge, ipcRenderer } = require("electron");
let sttUrl = null;
let ttsUrl = null;
let platform = process.platform;
ipcRenderer.on("urls", (event, urls) => {
  sttUrl = urls.sttUrl;
  ttsUrl = urls.ttsUrl;
});
contextBridge.exposeInMainWorld("vertha", {
  sttUrl,
  ttsUrl,
  platform,
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  getPort: (service) => ipcRenderer.invoke("get-port", service),
  restartServices: () => ipcRenderer.invoke("restart-services"),
  getUrls: () => ipcRenderer.invoke("get-urls"),
  onSetupComplete: (callback) => {
    ipcRenderer.on("setup-complete", (event, config) => callback(config));
  }
});
