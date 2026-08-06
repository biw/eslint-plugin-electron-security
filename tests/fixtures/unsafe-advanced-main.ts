// @ts-nocheck

import { session } from 'electron';
import { FuseV1Options } from '@electron/fuses';

session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'X-Frame-Options': ['DENY'],
    },
  });
});

session.defaultSession.setProxy({});
mainWindow.loadURL('https://example.com');

const electronFuseConfig = {
  [FuseV1Options.RunAsNode]: true,
  version: 1,
};
