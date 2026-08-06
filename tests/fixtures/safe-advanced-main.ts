// @ts-nocheck

import { session } from 'electron';
import { FuseV1Options } from '@electron/fuses';

session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  if (permission === 'notifications') {
    callback(true);
    return;
  }

  callback(false);
});

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self'"],
    },
  });
});

mainWindow.loadURL('https://example.com');

const electronFuseConfig = {
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
  [FuseV1Options.RunAsNode]: false,
  version: 1,
};
