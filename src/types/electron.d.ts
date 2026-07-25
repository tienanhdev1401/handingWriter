// Type declarations for Electron IPC API exposed via preload.cjs
// Available as window.electronAPI when running inside Electron

interface SaveResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface ElectronAPI {
  isElectron: true;
  getSaveFolder: () => Promise<string | null>;
  selectSaveFolder: () => Promise<string | null>;
  clearSaveFolder: () => Promise<boolean>;
  saveGifFile: (filename: string, data: Uint8Array) => Promise<SaveResult>;
  showInFolder: (filePath: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
