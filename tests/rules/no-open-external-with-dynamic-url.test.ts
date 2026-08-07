import rule from '../../src/rules/no-open-external-with-dynamic-url';
import { ruleTester } from '../rule-tester';

ruleTester.run('no-open-external-with-dynamic-url', rule, {
  valid: [
    {
      code: `
        import { shell } from 'electron';
        shell.openExternal('https://example.com');
        shell.openExternal('mailto:test@example.com');
      `,
    },
    {
      name: 'a preceding failure guard proves the configured validator ran',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        function open(url: string) {
          if (!isHttpUrl(url)) throw new Error('unsupported protocol');
          shell.openExternal(url);
        }
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
    },
    {
      name: 'a configured validator may be passed to openExternal inline',
      code: `
        import { shell } from 'electron';
        declare const parseOpenableExternalUrl: (value: string) => string;
        shell.openExternal(parseOpenableExternalUrl(userSuppliedUrl));
      `,
      options: [{ urlValidators: ['parseOpenableExternalUrl'] }],
    },
    {
      code: `
        import { shell } from 'electron';
        const openExternal = shell.openExternal.bind(shell);
        openExternal('https://example.com');
      `,
    },
    {
      code: `
        import { shell } from 'electron';
        const { openExternal } = shell;
        openExternal('https://example.com');
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { shell } from 'electron';
        shell.openExternal(userSuppliedUrl);
      `,
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'a validator that runs after openExternal cannot guard it',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        function open(url: string) {
          shell.openExternal(url);
          if (!isHttpUrl(url)) throw new Error('unsupported protocol');
        }
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'a positive validator return does not make the following call safe',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        function open(url: string) {
          if (isHttpUrl(url)) return;
          shell.openExternal(url);
        }
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'a value derived from a validator loses trust after reassignment',
      code: `
        import { shell } from 'electron';
        declare const validate: (value: string) => string;
        function open(raw: string) {
          let url = validate(raw);
          url = raw;
          shell.openExternal(url);
        }
      `,
      options: [{ urlValidators: ['validate'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      name: 'a guarded value loses trust after reassignment',
      code: `
        import { shell } from 'electron';
        declare const isHttpUrl: (value: string) => boolean;
        function open(url: string, raw: string) {
          if (!isHttpUrl(url)) throw new Error('unsupported protocol');
          url = raw;
          shell.openExternal(url);
        }
      `,
      options: [{ urlValidators: ['isHttpUrl'] }],
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      code: `
        import { shell } from 'electron';
        shell.openExternal('http://example.com');
      `,
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      code: `
        import { shell } from 'electron';
        const openExternal = shell.openExternal;
        openExternal(userSuppliedUrl);
      `,
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
    {
      code: `
        import { shell } from 'electron';
        const { openExternal } = shell;
        openExternal(userSuppliedUrl);
      `,
      errors: [{ messageId: 'unsafeOpenExternal' }],
    },
  ],
});
