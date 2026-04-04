const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  print: (htmlContent) => ipcRenderer.invoke('print-bill', htmlContent),
  windowPrint: () => ipcRenderer.invoke('window-print'),
  onPrintError: (callback) => ipcRenderer.on('print-error', (event, error) => callback(error))
});