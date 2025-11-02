"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    selectMusicFolder: () => electron_1.ipcRenderer.invoke('select-music-folder'),
    scanDirectory: (dirPath) => electron_1.ipcRenderer.invoke('scan-directory', dirPath),
});
