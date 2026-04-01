// @ts-nocheck

import { BrowserWindow, ipcMain, shell } from 'electron';

const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,
    sandbox: false,
    webSecurity: false,
    allowRunningInsecureContent: true,
    experimentalFeatures: true,
    enableBlinkFeatures: 'PreciseMemoryInfo',
  },
});

win.loadURL('http://example.com');
win.webContents.on(
  'will-attach-webview',
  (_event, webPreferences, params) => {
    console.log(webPreferences, params.partition);
  },
);
win.webContents.on('will-navigate', (_event, url) => {
  console.log(url);
});
win.webContents.setWindowOpenHandler(() => ({ action: 'allow' }));
ipcMain.handle('save', (_event, payload) => payload);
shell.openExternal(userSuppliedUrl);
