# eslint-plugin-electron-security

ESLint rules based on a subset of [Electron's official security checklist](https://www.electronjs.org/docs/latest/tutorial/security).

> [!IMPORTANT]
> This package alone does not prove that an Electron app is secure. It is designed to be a set of high-signal checks for common literal misconfigurations, not deep whole-program security analysis. Passing lint means these rules did not find an obvious violation, not that there are no violations.

## What This Is Good For

- Catching obvious unsafe Electron defaults before they land.
- Giving teams a baseline `recommended` config for CI and code review.
- Making Electron's security checklist more concrete in day-to-day development.

## What This Does Not Do

- It does not replace threat modeling, manual security review, or runtime hardening.
- It does not verify that every navigation, IPC path, or window creation flow is safe.
- It does not reliably analyze dynamic configuration, cross-file factories, spreads, or environment-driven branches.
- It does not cover every Electron security checklist item. Some items require runtime checks or other tooling.

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

### Type-Checked Rules

Add the typed preset if you lint preload code with TypeScript and [`typescript-eslint`](https://typescript-eslint.io/).

Today this adds a preload-focused rule for raw Electron API exposure. It is not a broad type-driven security analysis mode.

```js
import electronSecurity from "eslint-plugin-electron-security";

export default [
  electronSecurity.configs.recommended,
  electronSecurity.configs["recommended-type-checked"],
];
```

## Implemented Rules

<!-- GENERATED_RULE_MATRIX_START -->
| Rule | Covers | Config |
| --- | --- | --- |
| [`no-insecure-load-url`](./docs/rules/no-insecure-load-url.md) | Only load secure content | `recommended` |
| [`no-node-integration-for-remote-content`](./docs/rules/no-node-integration-for-remote-content.md) | Do not enable Node.js integration for remote content | `recommended` |
| [`no-context-isolation-disabled`](./docs/rules/no-context-isolation-disabled.md) | Enable context isolation in all renderers | `recommended` |
| [`no-sandbox-disabled`](./docs/rules/no-sandbox-disabled.md) | Enable process sandboxing | `recommended` |
| [`no-web-security-disabled`](./docs/rules/no-web-security-disabled.md) | Do not disable webSecurity | `recommended` |
| [`no-allow-running-insecure-content`](./docs/rules/no-allow-running-insecure-content.md) | Do not enable allowRunningInsecureContent | `recommended` |
| [`no-experimental-features`](./docs/rules/no-experimental-features.md) | Do not enable experimental features | `recommended` |
| [`no-enable-blink-features`](./docs/rules/no-enable-blink-features.md) | Do not use enableBlinkFeatures | `recommended` |
| [`no-webview-allowpopups`](./docs/rules/no-webview-allowpopups.md) | &lt;webview&gt;: do not use allowpopups | `recommended` |
| [`require-safe-webview-attachment`](./docs/rules/require-safe-webview-attachment.md) | &lt;webview&gt;: verify options and params | `recommended` |
| [`require-navigation-allowlist`](./docs/rules/require-navigation-allowlist.md) | Disable or limit navigation | `recommended` |
| [`require-window-open-handler`](./docs/rules/require-window-open-handler.md) | Disable or limit creation of new windows | `recommended` |
| [`no-open-external-with-dynamic-url`](./docs/rules/no-open-external-with-dynamic-url.md) | Do not use shell.openExternal with untrusted content | `recommended` |
| [`require-ipc-sender-validation`](./docs/rules/require-ipc-sender-validation.md) | Validate the sender of all IPC messages | `recommended` |
| [`no-file-protocol-load-url`](./docs/rules/no-file-protocol-load-url.md) | Avoid file:// and prefer custom protocols | `recommended` |
| [`no-raw-electron-api-exposure`](./docs/rules/no-raw-electron-api-exposure.md) | Do not expose Electron APIs to untrusted web content | `recommended-type-checked` |
<!-- GENERATED_RULE_MATRIX_END -->
