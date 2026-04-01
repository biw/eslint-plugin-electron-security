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
