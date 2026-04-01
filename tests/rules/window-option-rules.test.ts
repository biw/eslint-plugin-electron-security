import noAllowRunningInsecureContent from '../../src/rules/no-allow-running-insecure-content';
import noContextIsolationDisabled from '../../src/rules/no-context-isolation-disabled';
import noEnableBlinkFeatures from '../../src/rules/no-enable-blink-features';
import noExperimentalFeatures from '../../src/rules/no-experimental-features';
import noSandboxDisabled from '../../src/rules/no-sandbox-disabled';
import noWebSecurityDisabled from '../../src/rules/no-web-security-disabled';
import { ruleTester } from '../rule-tester';

ruleTester.run('no-context-isolation-disabled', noContextIsolationDisabled, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { contextIsolation: true } });
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { contextIsolation: false } });
      `,
      errors: [{ messageId: 'disabledContextIsolation' }],
    },
  ],
});

ruleTester.run('no-sandbox-disabled', noSandboxDisabled, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { sandbox: true } });
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { sandbox: false } });
      `,
      errors: [{ messageId: 'disabledSandbox' }],
    },
  ],
});

ruleTester.run('no-web-security-disabled', noWebSecurityDisabled, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { webSecurity: true } });
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { webSecurity: false } });
      `,
      errors: [{ messageId: 'disabledWebSecurity' }],
    },
    {
      code: `<webview disablewebsecurity />;`,
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      errors: [{ messageId: 'disabledWebSecurity' }],
    },
  ],
});

ruleTester.run('no-allow-running-insecure-content', noAllowRunningInsecureContent, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { allowRunningInsecureContent: false } });
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { allowRunningInsecureContent: true } });
      `,
      errors: [{ messageId: 'insecureContent' }],
    },
  ],
});

ruleTester.run('no-experimental-features', noExperimentalFeatures, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { experimentalFeatures: false } });
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { experimentalFeatures: true } });
      `,
      errors: [{ messageId: 'experimentalFeatures' }],
    },
  ],
});

ruleTester.run('no-enable-blink-features', noEnableBlinkFeatures, {
  valid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow();
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { BrowserWindow } from 'electron';
        new BrowserWindow({ webPreferences: { enableBlinkFeatures: 'PreciseMemoryInfo' } });
      `,
      errors: [{ messageId: 'blinkFeatures' }],
    },
  ],
});
