import { RuleTester } from '@typescript-eslint/rule-tester';

export const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});
