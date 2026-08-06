import rule from '../../src/rules/no-open-external-with-dynamic-url';
import { ruleTester } from '../rule-tester';

/**
 * Options coverage for shell.openExternal.
 *
 * The `urlValidators` case mirrors a real pattern that previously required a
 * permanent eslint-disable comment: parse and protocol-check a URL, then open
 * the parsed result.
 */
ruleTester.run('no-open-external-with-dynamic-url (options)', rule, {
  valid: [
    {
      name: 'validated URL passed through toString()',
      code: `
        import { shell } from 'electron';
        declare const parseOpenableExternalUrl: (value: string) => URL | null;
        const openExternalUrl = async (targetUrl: string) => {
          const parsedUrl = parseOpenableExternalUrl(targetUrl);
          if (parsedUrl === null) {
            throw new Error('Only http(s) URLs are allowed');
          }
          await shell.openExternal(parsedUrl.toString());
        };
      `,
      options: [{ urlValidators: ['parseOpenableExternalUrl'] }],
    },
    {
      name: 'validated URL passed via href',
      code: `
        import { shell } from 'electron';
        declare const parseUrl: (value: string) => URL;
        const open = (raw: string) => {
          const parsed = parseUrl(raw);
          shell.openExternal(parsed.href);
        };
      `,
      options: [{ urlValidators: ['parseUrl'] }],
    },
    {
      name: 'guard-then-use: parameter gated by a validator that throws',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        export const openValidatedExternalUrl = async ({ url }: { url: string }) => {
          if (!isHttpUrl(url)) {
            throw new Error('Only http and https URLs can be opened.');
          }
          await shell.openExternal(url);
        };
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
    },
    {
      name: 'guard-then-use with an early return',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        const open = (url: string) => {
          if (!isHttpUrl(url)) return;
          shell.openExternal(url);
        };
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
    },
    {
      name: 'custom protocol allowlist',
      code: `
        import { shell } from 'electron';
        shell.openExternal('slack://channel?id=1');
      `,
      options: [{ allowedProtocols: ['https:', 'slack:'] }],
    },
    {
      name: 'default allowlist still accepts https',
      code: `
        import { shell } from 'electron';
        shell.openExternal('https://example.com');
      `,
    },
  ],
  invalid: [
    {
      name: 'unvalidated dynamic URL',
      code: `
        import { shell } from 'electron';
        const open = (raw: string) => shell.openExternal(raw);
      `,
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'a different function than the configured validator',
      code: `
        import { shell } from 'electron';
        declare const decorateUrl: (value: string) => string;
        const open = (raw: string) => {
          const decorated = decorateUrl(raw);
          shell.openExternal(decorated);
        };
      `,
      options: [{ urlValidators: ['parseOpenableExternalUrl'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'protocol outside the configured allowlist',
      code: `
        import { shell } from 'electron';
        shell.openExternal('file:///etc/passwd');
      `,
      options: [{ allowedProtocols: ['https:'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'javascript: URL is never allowed by the default list',
      code: `
        import { shell } from 'electron';
        shell.openExternal('javascript:alert(1)');
      `,
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'guard exists but does not bail out, so it gates nothing',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        const open = (url: string) => {
          if (!isHttpUrl(url)) {
            log('suspicious url');
          }
          shell.openExternal(url);
        };
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'guard runs over a different variable than the one opened',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        const open = (url: string, other: string) => {
          if (!isHttpUrl(other)) {
            throw new Error('bad');
          }
          shell.openExternal(url);
        };
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'validators configured but the value is not derived from one',
      code: `
        import { shell } from 'electron';
        const open = (raw: string) => shell.openExternal(raw);
      `,
      options: [{ urlValidators: ['parseOpenableExternalUrl'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
  ],
});
