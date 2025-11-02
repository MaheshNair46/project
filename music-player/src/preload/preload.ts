import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  selectMusicFolder: () => ipcRenderer.invoke('select-music-folder'),
  scanDirectory: (dirPath: string) => ipcRenderer.invoke('scan-directory', dirPath),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;