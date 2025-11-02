"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const electronAPI = {
    selectMusicFolder: () => electron_1.ipcRenderer.invoke('select-music-folder'),
    scanDirectory: (dirPath) => electron_1.ipcRenderer.invoke('scan-directory', dirPath),
};
electron_1.contextBridge.exposeInMainWorld('electronAPI', electronAPI);
