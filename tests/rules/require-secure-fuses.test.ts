import rule from '../../src/rules/require-secure-fuses';
import { ruleTester } from '../rule-tester';

/**
 * Fuse configuration lives in electron-builder / Electron Forge config, which is
 * ordinary TypeScript. The values are literals, so this rule is provable rather
 * than heuristic.
 */
ruleTester.run('require-secure-fuses', rule, {
  valid: [
    {
      name: 'a fully hardened fuse config',
      code: `
        import { FuseV1Options, FuseVersion } from '@electron/fuses';
        const electronFuseConfig = {
          [FuseV1Options.EnableCookieEncryption]: true,
          [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
          [FuseV1Options.EnableNodeCliInspectArguments]: false,
          [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
          [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
          [FuseV1Options.OnlyLoadAppFromAsar]: true,
          [FuseV1Options.RunAsNode]: false,
          strictlyRequireAllFuses: true,
          version: FuseVersion.V1,
        };
      `,
    },
    {
      name: 'an unrelated object bag with a similar property name is ignored',
      code: `
        const options = { RunAsNode: true, unrelated: 1 };
      `,
    },
    {
      name: 'a dynamic fuse value is not guessed at',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        declare const isDev: boolean;
        const config = {
          [FuseV1Options.RunAsNode]: isDev,
          version: 1,
        };
      `,
    },
    {
      name: 'string keys in the safe configuration',
      code: `
        const config = {
          RunAsNode: false,
          OnlyLoadAppFromAsar: true,
          version: 1,
        };
      `,
    },
    {
      name: 'a safe later spread overrides an earlier unsafe fuse value',
      code: `
        import { flipFuses } from '@electron/fuses';
        const unsafe = { RunAsNode: true };
        const safe = { RunAsNode: false };
        const config = { ...unsafe, ...safe, version: 1 };
        await flipFuses('/path/to/app', config);
      `,
    },
    {
      name: 'an unrelated local flipFuses function is ignored',
      code: `
        function flipFuses(path: string, config: object) {}
        flipFuses('/path/to/app', { RunAsNode: true });
      `,
    },
    {
      name: 'an opaque later spread prevents a stale fuse finding',
      code: `
        import { flipFuses } from '@electron/fuses';
        declare const override: object;
        const config = { RunAsNode: true, ...override, version: 1 };
        await flipFuses('/path/to/app', config);
      `,
    },
  ],
  invalid: [
    {
      name: 'RunAsNode left enabled',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        const config = {
          [FuseV1Options.RunAsNode]: true,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'node CLI inspect arguments enabled',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        const config = {
          [FuseV1Options.EnableNodeCliInspectArguments]: true,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'NODE_OPTIONS injection left enabled',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        const config = {
          [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: true,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'asar integrity validation disabled',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        const config = {
          [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeEnabled' }],
    },
    {
      name: 'OnlyLoadAppFromAsar disabled',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        const config = {
          [FuseV1Options.OnlyLoadAppFromAsar]: false,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeEnabled' }],
    },
    {
      name: 'several unsafe fuses at once',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        const config = {
          [FuseV1Options.RunAsNode]: true,
          [FuseV1Options.OnlyLoadAppFromAsar]: false,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }, { messageId: 'fuseMustBeEnabled' }],
    },
    {
      name: 'hoisted boolean constant is resolved',
      code: `
        import { FuseV1Options } from '@electron/fuses';
        const ALLOW_NODE = true;
        const config = {
          [FuseV1Options.RunAsNode]: ALLOW_NODE,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'config passed to flipFuses through a constant',
      code: `
        import { flipFuses, FuseV1Options } from '@electron/fuses';
        const unsafe = { [FuseV1Options.RunAsNode]: true, version: 1 };
        await flipFuses('/path/to/app', unsafe);
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'aliased flipFuses import remains recognisable',
      code: `
        import { flipFuses as flip } from '@electron/fuses';
        const config = { RunAsNode: true, version: 1 };
        await flip('/path/to/app', config);
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'namespace flipFuses import remains recognisable',
      code: `
        import * as fuses from '@electron/fuses';
        const config = { RunAsNode: true, version: 1 };
        await fuses.flipFuses('/path/to/app', config);
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'require()-aliased flipFuses remains recognisable',
      code: `
        const { flipFuses: flip } = require('@electron/fuses');
        const config = { RunAsNode: true, version: 1 };
        await flip('/path/to/app', config);
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'string keys in an unsafe configuration',
      code: `
        const config = {
          RunAsNode: true,
          version: 1,
        };
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
    {
      name: 'an unsafe later spread overrides an earlier safe fuse value',
      code: `
        import { flipFuses } from '@electron/fuses';
        const safe = { RunAsNode: false };
        const unsafe = { RunAsNode: true };
        const config = { ...safe, ...unsafe, version: 1 };
        await flipFuses('/path/to/app', config);
      `,
      errors: [{ messageId: 'fuseMustBeDisabled' }],
    },
  ],
});
