import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  selectMusicFolder: () => ipcRenderer.invoke('select-music-folder'),
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('scan-directory', dirPath),
});

export type ElectronAPI = typeof electronAPI;