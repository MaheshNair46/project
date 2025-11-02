"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = require("path");
const promises_1 = require("fs/promises");
const path_2 = require("path");
const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            webSecurity: false, // Allow local file access
            preload: (0, path_1.join)(__dirname, '../preload/preload.js'),
        },
        titleBarStyle: 'hiddenInset',
        show: false,
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile((0, path_1.join)(__dirname, '../renderer/index.html'));
    }
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show();
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
// IPC handlers for file system operations
electron_1.ipcMain.handle('select-music-folder', async () => {
    if (!mainWindow)
        return null;
    const result = await electron_1.dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Music Folder',
    });
    if (result.canceled)
        return null;
    return result.filePaths[0];
});
electron_1.ipcMain.handle('scan-directory', async (_, dirPath) => {
    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg'];
    const audioFiles = [];
    async function scanDirectory(dir) {
        try {
            const entries = await (0, promises_1.readdir)(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = (0, path_1.join)(dir, entry.name);
                if (entry.isDirectory()) {
                    await scanDirectory(fullPath);
                }
                else if (entry.isFile()) {
                    const ext = (0, path_2.extension)(entry.name).toLowerCase();
                    if (audioExtensions.includes(ext)) {
                        audioFiles.push(fullPath);
                    }
                }
            }
        }
        catch (error) {
            console.error(`Error scanning directory ${dir}:`, error);
        }
    }
    await scanDirectory(dirPath);
    return audioFiles;
});
