import rule from '../../src/rules/require-window-open-handler';
import { ruleTester } from '../rule-tester';

ruleTester.run('require-window-open-handler', rule, {
  valid: [
    {
      code: `
        contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      `,
    },
    {
      code: `
        contents.setWindowOpenHandler(({ url }) => {
          if (url === 'https://example.com') {
            return { action: 'allow' };
          }

          return { action: 'deny' };
        });
      `,
    },
  ],
  invalid: [
    {
      code: `
        contents.setWindowOpenHandler(() => ({ action: 'allow' }));
      `,
      errors: [{ messageId: 'unsafeWindowOpenHandler' }],
    },
    {
      code: `
        const openHandler = () => {
          return { action: 'allow' };
        };

        contents.setWindowOpenHandler(openHandler);
      `,
      errors: [{ messageId: 'unsafeWindowOpenHandler' }],
    },
  ],
});
