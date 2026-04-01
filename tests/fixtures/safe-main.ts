// @ts-nocheck

import { BrowserWindow, ipcMain, shell } from 'electron';

const win = new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    experimentalFeatures: false,
  },
});

win.loadURL('https://example.com');
function validateSender(event) {
  if (event.senderFrame?.url !== 'https://example.com') {
    throw new Error('Untrusted IPC sender');
  }
}

win.webContents.on(
  'will-attach-webview',
  (event, webPreferences, params) => {
    if (!params.src.startsWith('https://example.com')) {
      event.preventDefault();
      return;
    }

    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
  },
);
win.webContents.on('will-navigate', (event, url) => {
  if (!url.startsWith('https://example.com')) {
    event.preventDefault();
  }
});
win.webContents.setWindowOpenHandler(({ url }) => {
  if (url === 'https://example.com') {
    return { action: 'allow' };
  }

  return { action: 'deny' };
});
ipcMain.handle('save', (event, payload) => {
  validateSender(event);
  return payload;
});
shell.openExternal('https://example.com');
