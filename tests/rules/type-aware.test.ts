import noOpenExternalWithDynamicUrl from '../../src/rules/no-open-external-with-dynamic-url';
import requireIpcSenderValidation from '../../src/rules/require-ipc-sender-validation';
import { typedRuleTester } from '../typed-rule-tester';

/**
 * Type-aware behaviour.
 *
 * These are the only signals in the plugin that are sound rather than
 * heuristic: a declared type predicate and a branded type are facts the
 * compiler enforces, and both resolve across file boundaries.
 *
 * Both rules must still work without type information, which the syntax-only
 * suites cover.
 */
typedRuleTester.run('require-ipc-sender-validation (type-aware)', requireIpcSenderValidation, {
  valid: [
    {
      name: 'type predicate counts as validation regardless of its name',
      code: `
        import { ipcMain } from 'electron';
        declare function frobnicate(event: unknown): event is { senderFrame: { url: string } };
        ipcMain.handle('a', (event, payload) => {
          if (!frobnicate(event)) return null;
          return payload;
        });
      `,
    },
    {
      name: 'assertion signature counts as validation regardless of its name',
      code: `
        import { ipcMain } from 'electron';
        declare function frobnicate(event: unknown): asserts event is { senderFrame: unknown };
        ipcMain.handle('b', (event, payload) => {
          frobnicate(event);
          return payload;
        });
      `,
    },
  ],
  invalid: [
    {
      name: 'an assertion after payload processing does not validate earlier work',
      code: `
        import { ipcMain } from 'electron';
        declare function frobnicate(event: unknown): asserts event is { senderFrame: unknown };
        declare function save(payload: unknown): void;
        ipcMain.handle('late-assertion', (event, payload) => {
          save(payload);
          frobnicate(event);
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      name: 'a type predicate ignored as a statement does not validate the sender',
      code: `
        import { ipcMain } from 'electron';
        declare function frobnicate(event: unknown): event is { senderFrame: { url: string } };
        ipcMain.handle('ignored-predicate', (event, payload) => {
          frobnicate(event);
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      name: 'a plain boolean-returning function is not a type guard',
      code: `
        import { ipcMain } from 'electron';
        declare function frobnicate(event: unknown): boolean;
        ipcMain.handle('c', (event, payload) => {
          frobnicate(event);
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
  ],
});

typedRuleTester.run('no-open-external-with-dynamic-url (type-aware)', noOpenExternalWithDynamicUrl, {
  valid: [
    {
      name: 'branded URL type is accepted',
      code: `
        import { shell } from 'electron';
        type ValidatedUrl = string & { readonly __brand: unique symbol };
        declare const validated: ValidatedUrl;
        shell.openExternal(validated);
      `,
      options: [{ trustedUrlType: 'ValidatedUrl' }],
    },
    {
      name: 'branded type flowing out of a validator function',
      code: `
        import { shell } from 'electron';
        type ValidatedUrl = string & { readonly __brand: unique symbol };
        declare function parseExternalUrl(raw: string): ValidatedUrl;
        const open = (raw: string) => {
          const url = parseExternalUrl(raw);
          shell.openExternal(url);
        };
      `,
      options: [{ trustedUrlType: 'ValidatedUrl' }],
    },
  ],
  invalid: [
    {
      name: 'a plain string is rejected when a brand is required',
      code: `
        import { shell } from 'electron';
        type ValidatedUrl = string & { readonly __brand: unique symbol };
        declare const raw: string;
        shell.openExternal(raw);
      `,
      options: [{ trustedUrlType: 'ValidatedUrl' }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'a differently branded type is rejected',
      code: `
        import { shell } from 'electron';
        type OtherBrand = string & { readonly __other: unique symbol };
        declare const other: OtherBrand;
        shell.openExternal(other);
      `,
      options: [{ trustedUrlType: 'ValidatedUrl' }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
  ],
});
