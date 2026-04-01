import rule from '../../src/rules/require-safe-webview-attachment';
import { ruleTester } from '../rule-tester';

ruleTester.run('require-safe-webview-attachment', rule, {
  valid: [
    {
      code: `
        contents.on('will-attach-webview', (event, webPreferences, params) => {
          if (!params.src.startsWith('https://example.com')) {
            event.preventDefault();
            return;
          }

          delete webPreferences.preload;
          webPreferences.nodeIntegration = false;
        });
      `,
    },
    {
      code: `
        contents.on('will-attach-webview', (_event, webPreferences, params) => {
          if (!params.src.startsWith('https://example.com')) {
            throw new Error('Unexpected webview URL');
          }

          delete webPreferences.preload;
          webPreferences.nodeIntegration = false;
          webPreferences.contextIsolation = true;
          console.log(params.partition);
        });
      `,
    },
    {
      code: `
        contents.on('will-attach-webview', (_event, webPreferences, params) => {
          sanitizeWebview(webPreferences, params);
        });
      `,
    },
    {
      code: `
        contents.on('will-attach-webview', (_event, webPreferences, params) => {
          params.src = 'https://example.com/embed';
          delete webPreferences.preload;
          webPreferences.nodeIntegration = false;
        });
      `,
    },
  ],
  invalid: [
    {
      code: `
        contents.on('will-attach-webview', (_event, webPreferences, params) => {
          console.log(webPreferences, params.partition);
        });
      `,
      errors: [{ messageId: 'unsafeWebviewAttachment' }],
    },
    {
      code: `
        contents.on('will-attach-webview', (_event, webPreferences, params) => {
          delete webPreferences.preload;
          console.log(params.src);
        });
      `,
      errors: [{ messageId: 'unsafeWebviewAttachment' }],
    },
    {
      code: `
        const attachHandler = (_event, webPreferences, params) => {
          console.log(webPreferences, params.src);
        };

        contents.on('will-attach-webview', attachHandler);
      `,
      errors: [{ messageId: 'unsafeWebviewAttachment' }],
    },
    {
      code: `
        contents.on('will-attach-webview', (_event, webPreferences, params) => {
          if (params.src.startsWith('https://example.com')) {
            delete webPreferences.preload;
          }
        });
      `,
      errors: [{ messageId: 'unsafeWebviewAttachment' }],
    },
  ],
});
