import { Linter } from 'eslint';
import { expect, it } from 'vitest';

import rule from '../../src/rules/require-factory';
import { ruleTester } from '../rule-tester';

const IPC_FACTORY = {
  factories: [
    { api: 'ipcMain.handle', use: 'handleSecure', allowIn: ['src/security/ipc.ts'] },
    { api: 'ipcMain.on', use: 'handleSecure', allowIn: ['src/security/ipc.ts'] },
  ],
};

const WINDOW_FACTORY = {
  factories: [{ api: 'BrowserWindow', use: 'createSecureWindow', allowIn: ['src/security/*.ts'] }],
};

const ALIASED_EXPORT_FACTORY = {
  factories: [
    { api: 'BrowserView', use: 'createSecureView', allowIn: ['src/security/views.ts'] },
    { api: 'session.fromPartition', use: 'getSecureSession', allowIn: ['src/security/session.ts'] },
  ],
};

const NOTIFICATION_FACTORY = {
  factories: [
    { api: 'Notification', use: 'showSafeNotification', allowIn: ['src/security/notifications.ts'] },
  ],
};

/**
 * The chokepoint rule. Unlike the heuristic rules, this one reports the
 * presence of a call it can see, so it should never need to guess.
 */
ruleTester.run('require-factory', rule, {
  valid: [
    {
      name: 'no configuration means the rule is inert',
      code: `
        import { ipcMain } from 'electron';
        ipcMain.handle('a', () => 1);
      `,
    },
    {
      name: 'direct use inside the allowed wrapper file',
      code: `
        import { ipcMain } from 'electron';
        export const handleSecure = (channel: string, fn: unknown) => ipcMain.handle(channel, fn as never);
      `,
      filename: 'src/security/ipc.ts',
      options: [IPC_FACTORY],
    },
    {
      name: 'callers use the wrapper instead of the raw API',
      code: `
        import { handleSecure } from './security/ipc';
        handleSecure('a', () => 1);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
    },
    {
      name: 'an unrelated handle method is not the Electron one',
      code: `
        import { queue } from './queue';
        queue.handle('a', () => 1);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
    },
    {
      name: 'glob allowlist matches the wrapper directory',
      code: `
        import { BrowserWindow } from 'electron';
        export const createSecureWindow = () => new BrowserWindow({ webPreferences: { sandbox: true } });
      `,
      filename: 'src/security/windows.ts',
      options: [WINDOW_FACTORY],
    },
    {
      name: 'allowlist entry matches an absolute path by suffix',
      code: `
        import { ipcMain } from 'electron';
        ipcMain.handle('a', () => 1);
      `,
      filename: '/Users/someone/project/src/security/ipc.ts',
      options: [IPC_FACTORY],
    },
    {
      name: 'a different Electron API is not restricted',
      code: `
        import { shell } from 'electron';
        shell.openExternal('https://example.com');
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
    },
  ],
  invalid: [
    {
      name: 'raw ipcMain.handle outside the wrapper',
      code: `
        import { ipcMain } from 'electron';
        ipcMain.handle('a', () => 1);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
      errors: [{ messageId: 'useFactory' }],
    },
    {
      name: 'raw ipcMain.on outside the wrapper',
      code: `
        import { ipcMain } from 'electron';
        ipcMain.on('a', () => 1);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
      errors: [{ messageId: 'useFactory' }],
    },
    {
      name: 'raw BrowserWindow construction outside the wrapper',
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow({ webPreferences: { sandbox: true } });
      `,
      filename: 'src/backend/windows.ts',
      options: [WINDOW_FACTORY],
      errors: [{ messageId: 'useFactory' }],
    },
    {
      name: 'aliased import does not evade the rule',
      code: `
        import { ipcMain as ipc } from 'electron';
        ipc.handle('a', () => 1);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
      errors: [{ messageId: 'useFactory' }],
    },
    {
      name: 'namespace import does not evade the rule',
      code: `
        import * as electron from 'electron';
        electron.ipcMain.handle('a', () => 1);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
      errors: [{ messageId: 'useFactory' }],
    },
    {
      name: 'require destructuring does not evade the rule',
      code: `
        const { ipcMain } = require('electron');
        ipcMain.handle('a', () => 1);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
      errors: [{ messageId: 'useFactory' }],
    },
    {
      name: 'every raw call site is reported',
      code: `
        import { ipcMain } from 'electron';
        ipcMain.handle('a', () => 1);
        ipcMain.handle('b', () => 2);
      `,
      filename: 'src/backend/runtime.ts',
      options: [IPC_FACTORY],
      errors: [{ messageId: 'useFactory' }, { messageId: 'useFactory' }],
    },
    {
      name: 'aliased BrowserView and session imports retain their original export names',
      code: `
        import { BrowserView as BV, session as ses } from 'electron';
        new BV();
        ses.fromPartition('persist:app');
      `,
      filename: 'src/backend/runtime.ts',
      options: [ALIASED_EXPORT_FACTORY],
      errors: [{ messageId: 'useFactory' }, { messageId: 'useFactory' }],
    },
    {
      name: 'a configured Notification constructor is restricted',
      code: `
        import { Notification } from 'electron';
        new Notification({ title: 'Update ready' });
      `,
      filename: 'src/backend/notifications.ts',
      options: [NOTIFICATION_FACTORY],
      errors: [{ messageId: 'useFactory' }],
    },
  ],
});

it('require-factory rejects unknown bare constructor names in its option schema', () => {
  const linter = new Linter();
  const config = [
    {
      plugins: { test: { rules: { factory: rule } } },
      rules: {
        'test/factory': [
          'error',
          { factories: [{ api: 'BroswerWindow', allowIn: ['src/security/windows.ts'] }] },
        ],
      },
    },
  ];

  expect(() => linter.verify('const value = 1;', config as never)).toThrow(/BroswerWindow/);
});
