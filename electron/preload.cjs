'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Expose safe IPC API vào renderer (window.electronAPI)
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // ── Save folder management ────────────────────────────────────────────────
  getSaveFolder: () => ipcRenderer.invoke('get-save-folder'),
  selectSaveFolder: () => ipcRenderer.invoke('select-save-folder'),
  clearSaveFolder: () => ipcRenderer.invoke('clear-save-folder'),

  // ── Save file trực tiếp ra disk ───────────────────────────────────────────
  // data: Uint8Array, trả về { success, path?, error? }
  saveGifFile: (filename, data) => ipcRenderer.invoke('save-gif-file', filename, Array.from(data)),

  // ── Reveal file trong Finder/Explorer sau khi lưu ─────────────────────────
  showInFolder: (filePath) => ipcRenderer.invoke('show-in-folder', filePath),
});
