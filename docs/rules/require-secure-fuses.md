# require-secure-fuses

Maps to Electron recommendation 19: "Check which fuses you can change".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Fuses are build-time flags baked into the packaged binary. Several of them exist
for backwards compatibility and hand an attacker a Node.js execution path inside
your signed application — which defeats sandboxing, context isolation and every
other renderer-side control this plugin checks.

## Why This Is Lintable

Fuses describe the built artifact, so this looks like something a linter cannot
see. In practice they are configured in `electron-builder.config.ts`,
`forge.config.js`, or a packaging script — ordinary source with literal values.
That makes this rule provable rather than heuristic.

The rule reads configuration, not the binary. It cannot confirm the fuses were
actually applied to a shipped build; use `@electron/fuses` to verify the artifact
if you need that guarantee.

## What It Flags

Must be **disabled**:

- `RunAsNode` — lets the packaged app be started as a plain Node process
- `EnableNodeCliInspectArguments` — lets `--inspect` attach a debugger to main
- `EnableNodeOptionsEnvironmentVariable` — lets `NODE_OPTIONS` inject code at startup
- `GrantFileProtocolExtraPrivileges` — gives `file://` pages extra capabilities

Must be **enabled**:

- `OnlyLoadAppFromAsar` — stops the app loading code from outside the signed archive
- `EnableEmbeddedAsarIntegrityValidation` — verifies the archive is untampered

Both `[FuseV1Options.RunAsNode]` and plain `RunAsNode` keys are recognised, and
hoisted boolean constants are resolved. Object spreads follow JavaScript's
source ordering, so the last value written for a fuse is the one checked.

## Incorrect

```ts
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config = {
  [FuseV1Options.RunAsNode]: true,
  [FuseV1Options.OnlyLoadAppFromAsar]: false,
  version: FuseVersion.V1,
};
```

## Correct

```ts
import { FuseV1Options, FuseVersion } from '@electron/fuses';

const config = {
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
```

## Notes

A fuse set to a non-literal value (`isDev`, a function call) is not reported —
the rule does not guess. It also only inspects objects it can recognise as fuse
configuration, so an unrelated bag with a `RunAsNode` property stays silent.

An absent fuse is not reported either: `strictlyRequireAllFuses: true` is the
mechanism that turns a missing fuse into a build-time error, and it is a better
tool for that job than a lint rule.

A call-shaped config is inspected only when `flipFuses` resolves to an import or
require from `@electron/fuses`. An unrelated local function with that name is
not Electron configuration.
