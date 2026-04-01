import rule from '../../src/rules/no-insecure-load-url';
import { ruleTester } from '../rule-tester';

ruleTester.run('no-insecure-load-url', rule, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow();
        win.loadURL('https://example.com');
      `,
    },
    {
      code: `
        const notElectron = { loadURL() {} };
        notElectron.loadURL('http://example.com');
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow();
        win.loadURL('http://example.com');
      `,
      errors: [{ messageId: 'insecureLoadUrl' }],
    },
    {
      code: `
        import { BrowserWindow } from 'electron';
        let win;
        win = new BrowserWindow();
        win.loadURL('http://example.com');
      `,
      errors: [{ messageId: 'insecureLoadUrl' }],
    },
    {
      code: `<webview src="ws://example.com/socket" />;`,
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      errors: [{ messageId: 'insecureLoadUrl' }],
    },
  ],
});
