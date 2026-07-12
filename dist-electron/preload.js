const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("vertha", {
  platform: process.platform,
  getConfig: () => ipcRenderer.invoke("get-config"),
  saveConfig: (config) => ipcRenderer.invoke("save-config", config),
  getPort: (service) => ipcRenderer.invoke("get-port", service),
  restartServices: () => ipcRenderer.invoke("restart-services"),
  getUrls: () => ipcRenderer.invoke("get-urls"),
  onSetupComplete: (callback) => {
    ipcRenderer.on("setup-complete", (event, config) => callback(config));
  }
});
