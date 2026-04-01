import rule from '../../src/rules/no-webview-allowpopups';
import { ruleTester } from '../rule-tester';

ruleTester.run('no-webview-allowpopups', rule, {
  valid: [
    {
      code: `<webview src="https://example.com" />;`,
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    },
  ],
  invalid: [
    {
      code: `<webview src="https://example.com" allowpopups />;`,
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      errors: [{ messageId: 'allowpopups' }],
    },
    {
      code: `<webview src="https://example.com" allowpopups={true} />;`,
      languageOptions: {
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
      errors: [{ messageId: 'allowpopups' }],
    },
  ],
});
