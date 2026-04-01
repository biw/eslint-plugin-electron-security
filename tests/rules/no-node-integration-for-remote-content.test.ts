import rule from '../../src/rules/no-node-integration-for-remote-content';
import { ruleTester } from '../rule-tester';

ruleTester.run('no-node-integration-for-remote-content', rule, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow({
          webPreferences: {
            nodeIntegration: true,
          },
        });
        win.loadURL(dynamicUrl);
      `,
    },
    {
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow({
          webPreferences: {
            nodeIntegration: false,
          },
        });
        win.loadURL('https://example.com');
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow({
          webPreferences: {
            nodeIntegration: true,
          },
        });
        win.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'remoteNodeIntegration' }],
    },
    {
      code: `
        import { BrowserWindow } from 'electron';
        let win;
        win = new BrowserWindow({
          webPreferences: {
            nodeIntegrationInSubFrames: true,
          },
        });
        win.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'remoteNodeIntegration' }],
    },
    {
      code: `<webview src="https://example.com" nodeintegration />;`,
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      errors: [{ messageId: 'remoteNodeIntegration' }],
    },
  ],
});
