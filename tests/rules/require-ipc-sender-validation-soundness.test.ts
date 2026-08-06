import rule from '../../src/rules/require-ipc-sender-validation';
import { ruleTester } from '../rule-tester';

/**
 * Precision and recall coverage for the sender-validation heuristic.
 *
 * The `valid` cases are shapes that must never be reported: a bogus error here
 * is what convinces a team to disable the whole plugin. The `invalid` cases are
 * handlers that look validated but are not.
 */
ruleTester.run('require-ipc-sender-validation (soundness)', rule, {
  valid: [
    {
      name: 'inline guard that throws',
      code: `
        import { ipcMain } from 'electron';
        declare const isTrustedRendererUrl: (url: string) => boolean;
        ipcMain.handle('save', (event, payload) => {
          if (!event.senderFrame || !isTrustedRendererUrl(event.senderFrame.url)) {
            throw new Error('untrusted sender');
          }
          return payload;
        });
      `,
    },
    {
      name: 'guard helper named with the assert prefix',
      code: `
        import { ipcMain } from 'electron';
        declare const assertTrustedSender: (event: unknown, channel: string) => void;
        ipcMain.handle('a', (event, payload) => {
          assertTrustedSender(event, 'a');
          return payload;
        });
      `,
    },
    {
      name: 'guard helper named with the require prefix',
      code: `
        import { ipcMain } from 'electron';
        declare const requireTrustedSender: (event: unknown, channel: string) => void;
        ipcMain.handle('b', (event, payload) => {
          requireTrustedSender(event, 'b');
          return payload;
        });
      `,
    },
    {
      name: 'project-specific guard name supplied via options',
      code: `
        import { ipcMain } from 'electron';
        declare const hanselSenderPolicy: (event: unknown) => void;
        ipcMain.handle('c', (event, payload) => {
          hanselSenderPolicy(event);
          return payload;
        });
      `,
      options: [{ senderGuards: ['hanselSenderPolicy'] }],
    },
    {
      name: 'guard wraps the remaining work instead of bailing out',
      code: `
        import { ipcMain } from 'electron';
        declare const isTrusted: (frame: unknown) => boolean;
        ipcMain.handle('d', (event, payload) => {
          if (isTrusted(event.senderFrame)) {
            doWork(payload);
          }
        });
      `,
    },
    {
      name: 'early return guard from the Electron docs',
      code: `
        import { ipcMain } from 'electron';
        declare const validateSender: (frame: unknown) => boolean;
        ipcMain.handle('get-secrets', (event) => {
          if (!validateSender(event.senderFrame)) return null;
          return getSecrets();
        });
      `,
    },
    {
      name: 'imported guard cannot be resolved, so it is trusted',
      code: `
        import { ipcMain } from 'electron';
        import { checkSender } from './security';
        ipcMain.handle('e', (event, payload) => {
          checkSender(event);
          return payload;
        });
      `,
    },
    {
      name: 'ternary gated on sender metadata',
      code: `
        import { ipcMain } from 'electron';
        declare const isTrusted: (frame: unknown) => boolean;
        ipcMain.handle('f', (event, payload) => isTrusted(event.senderFrame) ? payload : null);
      `,
    },
  ],
  invalid: [
    {
      name: 'no validation at all',
      code: `
        import { ipcMain } from 'electron';
        ipcMain.handle('save', (_event, payload) => payload);
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      name: 'locally defined guard that never reads its parameters',
      code: `
        import { ipcMain } from 'electron';
        const validateNothing = (_event: unknown) => true;
        ipcMain.handle('c', (event, payload) => {
          validateNothing(event);
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      name: 'conditional mentions the sender but does not gate anything',
      code: `
        import { ipcMain } from 'electron';
        ipcMain.handle('f', (event, payload) => {
          if (event.senderFrame) {
            log('received');
          }
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      name: 'guard-shaped call that never receives the event',
      code: `
        import { ipcMain } from 'electron';
        declare const assertSomethingElse: (value: string) => void;
        ipcMain.handle('g', (event, payload) => {
          assertSomethingElse('unrelated');
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      name: 'zero-parameter local guard cannot inspect the sender',
      code: `
        import { ipcMain } from 'electron';
        const isProduction = () => true;
        ipcMain.handle('h', (event, payload) => {
          isProduction();
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
  ],
});
