import { BrowserWindow, shell } from 'electron';

const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,
  },
});

win.loadURL(dynamicUrl);
shell.openExternal('https://example.com');
