import path from 'node:path';
import { fileURLToPath } from 'node:url';

import parser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const typedRuleTester = new RuleTester({
  languageOptions: {
    parser,
    parserOptions: {
      projectService: {
        allowDefaultProject: ['*.ts', '*.tsx'],
      },
      tsconfigRootDir: rootDir,
    },
  },
});
