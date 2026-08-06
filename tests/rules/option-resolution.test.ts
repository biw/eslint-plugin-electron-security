import noContextIsolationDisabled from '../../src/rules/no-context-isolation-disabled';
import noEnableBlinkFeatures from '../../src/rules/no-enable-blink-features';
import noNodeIntegrationForRemoteContent from '../../src/rules/no-node-integration-for-remote-content';
import noSandboxDisabled from '../../src/rules/no-sandbox-disabled';
import { ruleTester } from '../rule-tester';

/**
 * Regression coverage for indirection that a shallow literal check misses.
 *
 * Every `invalid` case here passed silently before the static resolution layer
 * existed. Real Electron apps hoist their window options into a shared factory
 * or constant, so these are the shapes that matter most in practice.
 */
ruleTester.run('no-sandbox-disabled (resolution)', noSandboxDisabled, {
  valid: [
    {
      name: 'hoisted const with a safe value',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { sandbox: true };
        new BrowserWindow({ webPreferences: prefs });
      `,
    },
    {
      name: 'let binding is not followed (it may be reassigned before use)',
      code: `
        import { BrowserWindow } from 'electron';
        let prefs = { sandbox: false };
        prefs = { sandbox: true };
        new BrowserWindow({ webPreferences: prefs });
      `,
    },
    {
      name: 'opaque spread after the unsafe value may override it',
      code: `
        import { BrowserWindow } from 'electron';
        declare const override: Record<string, unknown>;
        new BrowserWindow({ webPreferences: { sandbox: false, ...override } });
      `,
    },
    {
      name: 'a later literal overrides the earlier unsafe value',
      code: `
        import { BrowserWindow } from 'electron';
        const base = { sandbox: false };
        new BrowserWindow({ webPreferences: { ...base, sandbox: true } });
      `,
    },
    {
      name: 'imported option bag cannot be resolved, so stays silent',
      code: `
        import { BrowserWindow } from 'electron';
        import { prefs } from './prefs';
        new BrowserWindow({ webPreferences: prefs });
      `,
    },
    {
      name: 'a const option object mutated to an unsafe value is not treated as immutable',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { sandbox: true };
        prefs.sandbox = false;
        new BrowserWindow({ webPreferences: prefs });
      `,
    },
    {
      name: 'a later safe mutation prevents a false report from the initializer',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { sandbox: false };
        prefs.sandbox = true;
        new BrowserWindow({ webPreferences: prefs });
      `,
    },
    {
      name: 'an option bag passed to unknown code is no longer authoritative',
      code: `
        import { BrowserWindow } from 'electron';
        declare function harden(options: { sandbox: boolean }): void;
        const prefs = { sandbox: false };
        harden(prefs);
        new BrowserWindow({ webPreferences: prefs });
      `,
    },
  ],
  invalid: [
    {
      name: 'hoisted webPreferences const',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { sandbox: false };
        new BrowserWindow({ webPreferences: prefs });
      `,
      errors: [{ messageId: 'disabledSandbox' }],
    },
    {
      name: 'entire option bag hoisted',
      code: `
        import { BrowserWindow } from 'electron';
        const options = { webPreferences: { sandbox: false } };
        new BrowserWindow(options);
      `,
      errors: [{ messageId: 'disabledSandbox' }],
    },
    {
      name: 'unsafe value arrives through a resolvable spread',
      code: `
        import { BrowserWindow } from 'electron';
        const base = { sandbox: false };
        new BrowserWindow({ webPreferences: { ...base, devTools: false } });
      `,
      errors: [{ messageId: 'disabledSandbox' }],
    },
    {
      name: 'const chain through two hops',
      code: `
        import { BrowserWindow } from 'electron';
        const inner = { sandbox: false };
        const outer = inner;
        new BrowserWindow({ webPreferences: outer });
      `,
      errors: [{ messageId: 'disabledSandbox' }],
    },
    {
      name: 'boolean value itself is hoisted',
      code: `
        import { BrowserWindow } from 'electron';
        const SANDBOX = false;
        new BrowserWindow({ webPreferences: { sandbox: SANDBOX } });
      `,
      errors: [{ messageId: 'disabledSandbox' }],
    },
    {
      name: 'shared unsafe bag reports once, at the definition',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { sandbox: false };
        new BrowserWindow({ webPreferences: prefs });
        new BrowserWindow({ webPreferences: prefs });
      `,
      errors: [{ messageId: 'disabledSandbox' }],
    },
  ],
});

ruleTester.run('no-context-isolation-disabled (resolution)', noContextIsolationDisabled, {
  valid: [],
  invalid: [
    {
      name: 'hoisted bag disabling context isolation',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { contextIsolation: false, nodeIntegration: true };
        new BrowserWindow({ webPreferences: prefs });
      `,
      errors: [{ messageId: 'disabledContextIsolation' }],
    },
  ],
});

ruleTester.run('no-enable-blink-features (resolution)', noEnableBlinkFeatures, {
  valid: [
    {
      name: 'no blink features anywhere',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { sandbox: true };
        new BrowserWindow({ webPreferences: prefs });
      `,
    },
  ],
  invalid: [
    {
      name: 'blink features arrive via hoisted const',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { enableBlinkFeatures: 'PreciseMemoryInfo' };
        new BrowserWindow({ webPreferences: prefs });
      `,
      errors: [{ messageId: 'blinkFeatures' }],
    },
  ],
});

ruleTester.run('no-node-integration-for-remote-content (resolution)', noNodeIntegrationForRemoteContent, {
  valid: [
    {
      name: 'hoisted node integration but only local content is loaded',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { nodeIntegration: true };
        const win = new BrowserWindow({ webPreferences: prefs });
        win.loadURL('file:///app/index.html');
      `,
    },
  ],
  invalid: [
    {
      name: 'hoisted node integration with remote content',
      code: `
        import { BrowserWindow } from 'electron';
        const prefs = { nodeIntegration: true };
        const win = new BrowserWindow({ webPreferences: prefs });
        win.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'remoteNodeIntegration' }],
    },
  ],
});
