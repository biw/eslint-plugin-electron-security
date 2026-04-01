import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';

const ruleTester = RuleTester as any;

ruleTester.afterAll = afterAll;
ruleTester.afterEach = afterEach;
ruleTester.beforeAll = beforeAll;
ruleTester.beforeEach = beforeEach;
ruleTester.describe = describe;
ruleTester.it = it;
ruleTester.itOnly = it.only;
ruleTester.describeOnly = describe.only;
