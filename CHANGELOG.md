# Changelog

## 0.3.0 - 2026-07-27

### Fixed

- resolve `const` bindings and object spreads when reading window option bags, so
  the common `const prefs = { sandbox: false }` factory shape is no longer missed
  by every window-option rule
- stop reporting `{ sandbox: false, ...opaque }`, where a later spread could set a
  safe value
- stop reporting guards that do not match the built-in naming heuristic, such as
  `requireTrustedSender(event, channel)`
- report a locally declared "guard" that never reads its own parameters
- report a conditional that mentions the sender but does not gate the handler
- `require-permission-request-handler` no longer stays silent on apps that serve
  the renderer over a custom protocol. Keying "loads content" purely off
  `http(s)://` URLs made the rule blind to exactly the apps that followed
  Electron's advice to prefer custom schemes; `registerSchemesAsPrivileged` now
  counts as content evidence

### Added

- **Confidence tiers.** Rules are classified as `provable` (they report an unsafe
  literal they can see) or `inferred` (they report the absence of a mitigation they
  recognise). `recommended` now ships provable rules as errors and inferred rules as
  warnings, so adopting the plugin never turns CI red on a heuristic
- **`strict` config** promoting every rule to an error, for projects that have tuned
  the inferred rules
- **`require-factory`** — the single-door rule. Restrict an Electron API to one
  project-owned wrapper file and the rule guarantees nobody bypasses it, turning
  "did every call site remember to be safe?" into a question with an exact answer.
  Inert until configured
- **`require-permission-request-handler`** (recommendation 5) — missing permission
  handler on sessions loading remote content, and handlers that grant unconditionally
- **`require-csp`** (recommendation 7) — CSP weakened by `unsafe-inline`/`unsafe-eval`,
  wildcard `default-src`/`script-src`, and `onHeadersReceived` callbacks that omit CSP.
  Note that a CSP in a `.html` file is out of reach: ESLint only lints JS/TS
- **`require-secure-fuses`** (recommendation 19) — previously classified as "not
  lintable here". Fuses are configured in `electron-builder.config.ts` /
  `forge.config.js`, which is ordinary source, so this is provable after all.
  Flags `RunAsNode`, `EnableNodeCliInspectArguments`,
  `EnableNodeOptionsEnvironmentVariable` and `GrantFileProtocolExtraPrivileges`
  left enabled, and `OnlyLoadAppFromAsar` / `EnableEmbeddedAsarIntegrityValidation`
  disabled
- **Type-aware signals**, used automatically when a type-aware parser is configured
  and skipped otherwise:
  - a function declared as a type guard or assertion (`event is T`, `asserts event is T`)
    counts as sender validation regardless of its name, and resolves across files
  - `trustedUrlType` on `no-open-external-with-dynamic-url` accepts a branded type, so
    the compiler enforces the taint path across module boundaries
- `senderGuards` option for `require-ipc-sender-validation`
- `allowedProtocols` and `urlValidators` options for `no-open-external-with-dynamic-url`,
  including the derive-from-validator and guard-then-use shapes
- a Known Limits table in the README documenting what passes and why
- a Confidence column in the generated rule matrix

## 0.1.0 - 2026-04-08

- bootstrap the `eslint-plugin-electron-security` package with build, test, and release workflows
- add a metadata-driven rule matrix, generated README section, and rule documentation
- ship the first `v0` syntax-only Electron security rules plus flat-config `recommended`
- add rule tests, integration adoption tests, and CI checks for metadata and package export drift
