# eslint-plugin-electron-security

ESLint rules based on a subset of [Electron's official security checklist](https://www.electronjs.org/docs/latest/tutorial/security).

> [!IMPORTANT]
> This package alone does not prove that an Electron app is secure. Passing lint means these rules did not find a violation they can see, not that there are none. Read [Known Limits](#known-limits) before relying on a green run.

## What This Is Good For

- Catching unsafe Electron defaults before they land, including options hoisted into a shared factory.
- Enforcing that an Electron API is only reachable through a wrapper you own, which turns "did every call site remember?" into a question with an exact answer.
- Using type information, where you have it, to verify guards and validated URLs across file boundaries.
- Giving teams a baseline `recommended` config for CI and code review, graded so adoption does not turn CI red on a heuristic.

## What This Does Not Do

- It does not replace threat modeling, manual security review, or runtime hardening.
- It does not verify that every navigation, IPC path, or window creation flow is safe.
- It does not cover every Electron security checklist item. Some items require runtime checks or other tooling.

### Known Limits

Rather than describe these in the abstract, here is code that passes today.
Knowing the edges up front is more useful than discovering them later.

| Shape | Behaviour | Why |
| --- | --- | --- |
| `import { prefs } from './prefs'` used as `webPreferences` | Not reported | Option bags are resolved within a file only. |
| `let prefs = {...}` used as `webPreferences` | Not reported | A `let` binding may be reassigned before the window is built, so its initializer is not authoritative. |
| `harden(prefs)` before using a const option bag | Not reported | Unknown code may retain or mutate the object, so its initializer no longer proves the constructed value. |
| `{ sandbox: false, ...opaque }` | Not reported | The spread could set `sandbox: true`; reporting would be a guess. |
| `{ [key]: false }` with a computed key | Not reported | The key is not statically known. |
| An imported guard passed the IPC event | Treated as validation | Its body is not analysed. Declare it as a type guard (`event is T`) and the typed preset verifies it properly. |
| A guard whose allowlist is wrong | Treated as validation | The rule checks that a guard ran, not that it is correct. `require-factory` narrows this to one reviewable file. |
| Whether the app has a CSP *anywhere* | Not reported | Unprovable per-file. `require-csp` only reports CSP it can see being weakened. |
| **A CSP in a `.html` file** | **Not reported** | ESLint only lints JS/TS. A `<meta http-equiv="Content-Security-Policy">` in `index.html` is invisible to this plugin — including one with `'unsafe-inline'`. Check those by hand or with an HTML linter. |
| Whether fuses were applied to the shipped binary | Not reported | `require-secure-fuses` reads your build config, not the artifact. Use `@electron/fuses` to verify a real build. |
| The shipped Electron version vs. known CVEs | Not reported | Needs a vulnerability database, not a linter. |

Constants and spreads *within* a file are resolved, so the common
`const prefs = { sandbox: false }` factory shape is reported.

## Install

```bash
npm install --save-dev eslint eslint-plugin-electron-security
```

## Usage

Use the recommended config as a baseline, not as a security guarantee.

```js
import electronSecurity from "eslint-plugin-electron-security";

export default [electronSecurity.configs.recommended];
```

### Confidence Tiers

Rules differ in how they can be wrong, and the presets reflect that.

- **Provable** rules report an unsafe literal they can see — `sandbox: false`. When they fire they are right, so `recommended` ships them as **errors**.
- **Inferred** rules report the *absence* of a mitigation they recognise — "no sender validation here". Any valid pattern the rule does not recognise reads as a violation, so `recommended` ships them as **warnings**.

That means adopting the plugin never turns CI red on a heuristic, while the inferred findings stay visible and countable from the first run.

Once you have configured the inferred rules for your codebase, promote everything to errors:

```js
export default [electronSecurity.configs.strict];
```

### The Single-Door Pattern

The strongest thing this plugin can do is stop asking "did you remember to do the safe thing?" and start asking "did you go through the one door?" — a question with an exact answer.

Write a wrapper your project owns, then make it the only way in:

```js
{
  rules: {
    "electron-security/require-factory": ["error", {
      factories: [
        { api: "ipcMain.handle", use: "handleSecure", allowIn: ["src/security/ipc.ts"] },
        { api: "BrowserWindow", use: "createSecureWindow", allowIn: ["src/security/windows.ts"] },
      ],
    }],
  },
}
```

This turns a heuristic into a proof: instead of hunting every handler for evidence of validation, the security-critical logic lives in one small reviewable file and the rule guarantees nobody bypasses it. See [`require-factory`](./docs/rules/require-factory.md).

### Type-Checked Rules

Add the typed preset if you lint with TypeScript and [`typescript-eslint`](https://typescript-eslint.io/).

Type information unlocks the only *sound* signals available to a linter, because both resolve across file boundaries:

- **Declared type guards.** A function typed `(event: unknown) => event is TrustedEvent`, or `asserts event is …`, counts as sender validation regardless of what it is named. That is a fact about the signature, not a naming convention.
- **Branded URL types.** Point `no-open-external-with-dynamic-url` at a brand and the compiler enforces the taint path for you:

```js
{
  "electron-security/no-open-external-with-dynamic-url": ["error", { trustedUrlType: "ValidatedUrl" }],
}
```

```ts
type ValidatedUrl = string & { readonly __brand: unique symbol };
declare function parseExternalUrl(raw: string): ValidatedUrl | null;
// Only a value that came through parseExternalUrl typechecks here.
shell.openExternal(validated);
```

These rules degrade gracefully: without type information they fall back to the syntactic heuristics, so the same config works in both modes.

```js
import electronSecurity from "eslint-plugin-electron-security";

export default [
  electronSecurity.configs.recommended,
  electronSecurity.configs["recommended-type-checked"],
];
```

### Rule Options

Five rules take options so a project can describe its own conventions instead of
reaching for `eslint-disable`.

```js
export default [
  electronSecurity.configs.recommended,
  {
    rules: {
      // Your guard does not have to match the default naming heuristic.
      "electron-security/require-ipc-sender-validation": [
        "error",
        { senderGuards: ["isTrustedRendererUrl"] },
      ],
      // Teach the rule which functions validate a URL.
      "electron-security/no-open-external-with-dynamic-url": [
        "error",
        {
          allowedProtocols: ["https:", "mailto:"],
          urlValidators: ["parseOpenableExternalUrl", "isHttpUrl"],
          trustedUrlType: "ValidatedUrl",
        },
      ],
      // Restrict an Electron API to the wrapper that owns it.
      "electron-security/require-factory": [
        "error",
        { factories: [{ api: "ipcMain.handle", use: "handleSecure", allowIn: ["src/security/ipc.ts"] }] },
      ],
      // Keep only the unconditional-grant half if the handler lives elsewhere.
      "electron-security/require-permission-request-handler": ["error", { requireHandler: false }],
      // Permit a directive while you migrate off it.
      "electron-security/require-csp": ["error", { allowUnsafeInline: true }],
    },
  },
];
```

Each rule's options are documented in full under [`docs/rules/`](./docs/rules).

## Implemented Rules

<!-- GENERATED_RULE_MATRIX_START -->
| Rule | Covers | Confidence | Config |
| --- | --- | --- | --- |
| [`no-insecure-load-url`](./docs/rules/no-insecure-load-url.md) | Only load secure content | provable | `recommended` (error) |
| [`no-node-integration-for-remote-content`](./docs/rules/no-node-integration-for-remote-content.md) | Do not enable Node.js integration for remote content | provable | `recommended` (error) |
| [`no-context-isolation-disabled`](./docs/rules/no-context-isolation-disabled.md) | Enable context isolation in all renderers | provable | `recommended` (error) |
| [`no-sandbox-disabled`](./docs/rules/no-sandbox-disabled.md) | Enable process sandboxing | provable | `recommended` (error) |
| [`require-permission-request-handler`](./docs/rules/require-permission-request-handler.md) | Use ses.setPermissionRequestHandler() in sessions that load remote content | inferred | `recommended` (warn) · `strict` (error) |
| [`no-web-security-disabled`](./docs/rules/no-web-security-disabled.md) | Do not disable webSecurity | provable | `recommended` (error) |
| [`require-csp`](./docs/rules/require-csp.md) | Define a Content Security Policy | inferred | `recommended` (warn) · `strict` (error) |
| [`no-allow-running-insecure-content`](./docs/rules/no-allow-running-insecure-content.md) | Do not enable allowRunningInsecureContent | provable | `recommended` (error) |
| [`no-experimental-features`](./docs/rules/no-experimental-features.md) | Do not enable experimental features | provable | `recommended` (error) |
| [`no-enable-blink-features`](./docs/rules/no-enable-blink-features.md) | Do not use enableBlinkFeatures | provable | `recommended` (error) |
| [`no-webview-allowpopups`](./docs/rules/no-webview-allowpopups.md) | &lt;webview&gt;: do not use allowpopups | provable | `recommended` (error) |
| [`require-safe-webview-attachment`](./docs/rules/require-safe-webview-attachment.md) | &lt;webview&gt;: verify options and params | inferred | `recommended` (warn) · `strict` (error) |
| [`require-navigation-allowlist`](./docs/rules/require-navigation-allowlist.md) | Disable or limit navigation | inferred | `recommended` (warn) · `strict` (error) |
| [`require-window-open-handler`](./docs/rules/require-window-open-handler.md) | Disable or limit creation of new windows | inferred | `recommended` (warn) · `strict` (error) |
| [`no-open-external-with-dynamic-url`](./docs/rules/no-open-external-with-dynamic-url.md) | Do not use shell.openExternal with untrusted content | inferred | `recommended` (warn) · `strict` (error) |
| [`require-ipc-sender-validation`](./docs/rules/require-ipc-sender-validation.md) | Validate the sender of all IPC messages | inferred | `recommended` (warn) · `strict` (error) |
| [`no-file-protocol-load-url`](./docs/rules/no-file-protocol-load-url.md) | Avoid file:// and prefer custom protocols | provable | `recommended` (error) |
| [`require-secure-fuses`](./docs/rules/require-secure-fuses.md) | Check which fuses you can change | provable | `recommended` (error) |
| [`no-raw-electron-api-exposure`](./docs/rules/no-raw-electron-api-exposure.md) | Do not expose Electron APIs to untrusted web content | provable | `recommended-type-checked` |
| [`require-factory`](./docs/rules/require-factory.md) | Route Electron APIs through a single audited factory | provable | `recommended` (error) |
<!-- GENERATED_RULE_MATRIX_END -->
