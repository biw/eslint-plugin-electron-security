import rule from '../../src/rules/require-navigation-allowlist';
import { ruleTester } from '../rule-tester';

ruleTester.run('require-navigation-allowlist', rule, {
  valid: [
    {
      code: `
        contents.on('will-navigate', (event, url) => {
          if (!url.startsWith('https://example.com')) {
            event.preventDefault();
          }
        });
      `,
    },
    {
      code: `
        function handleNavigate(event) {
          event.preventDefault();
        }

        contents.once('will-navigate', handleNavigate);
      `,
    },
  ],
  invalid: [
    {
      code: `
        contents.on('will-navigate', (_event, url) => {
          console.log(url);
        });
      `,
      errors: [{ messageId: 'unsafeNavigationHandler' }],
    },
    {
      code: `
        const handleNavigate = (event, url) => {
          console.log(event, url);
        };

        contents.addListener('will-navigate', handleNavigate);
      `,
      errors: [{ messageId: 'unsafeNavigationHandler' }],
    },
  ],
});
