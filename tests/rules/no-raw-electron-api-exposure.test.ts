import rule from '../../src/rules/no-raw-electron-api-exposure';
import { typedRuleTester } from '../typed-rule-tester';

typedRuleTester.run('no-raw-electron-api-exposure', rule, {
  valid: [
    {
      code: `
        import { contextBridge, ipcRenderer } from 'electron';

        const api = {
          send: (channel: string, payload: unknown) => ipcRenderer.send(channel, payload),
          onMessage: (channel: string, callback: (...args: unknown[]) => void) => {
            ipcRenderer.on(channel, (_event, ...args) => callback(...args));
          },
        };

        contextBridge.exposeInMainWorld('electron', api);
      `,
      filename: 'safe-preload.ts',
    },
  ],
  invalid: [
    {
      code: `
        import { contextBridge, ipcRenderer } from 'electron';

        contextBridge.exposeInMainWorld('electron', { ipcRenderer });
      `,
      filename: 'unsafe-preload.ts',
      errors: [{ messageId: 'rawElectronApi' }],
    },
    {
      code: `
        import { contextBridge, ipcRenderer } from 'electron';

        const raw = ipcRenderer;

        contextBridge.exposeInMainWorld('electron', { raw });
      `,
      filename: 'unsafe-alias-preload.ts',
      errors: [{ messageId: 'rawElectronApi' }],
    },
    {
      code: `
        import { contextBridge, ipcRenderer } from 'electron';

        const api = { on: ipcRenderer.on };

        contextBridge.exposeInMainWorld('electron', api);
      `,
      filename: 'unsafe-member-preload.ts',
      errors: [{ messageId: 'rawElectronApi' }],
    },
    {
      code: `
        import { contextBridge, shell } from 'electron';

        contextBridge.exposeInMainWorld('electron', { shell });
      `,
      filename: 'unsafe-shell-preload.ts',
      errors: [{ messageId: 'rawElectronApi' }],
    },
    {
      code: `
        import * as electron from 'electron';

        electron.contextBridge.exposeInMainWorld('electron', {
          clipboard: electron.clipboard,
        });
      `,
      filename: 'unsafe-namespace-preload.ts',
      errors: [{ messageId: 'rawElectronApi' }],
    },
    {
      code: `
        import { contextBridge, ipcRenderer } from 'electron';

        const onMessage = (channel: string, callback: (event: unknown, payload: string) => void) => {
          ipcRenderer.on(channel, (event, payload: string) => callback(event, payload));
        };

        contextBridge.exposeInMainWorld('electron', { onMessage });
      `,
      filename: 'unsafe-event-preload.ts',
      errors: [{ messageId: 'rawIpcEvent' }],
    },
  ],
});
