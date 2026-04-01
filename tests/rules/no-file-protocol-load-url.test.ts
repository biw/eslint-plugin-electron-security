import rule from '../../src/rules/no-file-protocol-load-url';
import { ruleTester } from '../rule-tester';

ruleTester.run('no-file-protocol-load-url', rule, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow();
        win.loadURL('https://example.com');
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow();
        win.loadURL('file:///Users/me/app/index.html');
      `,
      errors: [{ messageId: 'fileProtocol' }],
    },
    {
      code: `
        import { BrowserWindow } from 'electron';
        let win;
        win = new BrowserWindow();
        win.loadURL('file:///Users/me/app/index.html');
      `,
      errors: [{ messageId: 'fileProtocol' }],
    },
    {
      code: `<webview src="file:///Users/me/app/index.html" />;`,
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      errors: [{ messageId: 'fileProtocol' }],
    },
  ],
});
