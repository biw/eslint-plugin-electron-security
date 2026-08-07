# no-node-integration-for-remote-content

Maps to Electron recommendation 2: "Do not enable Node.js integration for remote content".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Remote content should not get Node.js powers directly. Electron's guidance is to keep
Node integration off for renderers that load remote pages and expose only narrow APIs
through preload code when necessary.

## What It Flags

- Same-file `BrowserWindow` or `WebContentsView` creation with `nodeIntegration: true`,
  `nodeIntegrationInSubFrames: true`, or `nodeIntegrationInWorker: true`, paired
  with a literal remote `loadURL(...)`
- `<webview>` tags that combine a literal remote `src` with `nodeintegration`

## Incorrect

```ts
import { BrowserWindow } from 'electron';

const win = new BrowserWindow({
  webPreferences: {
    nodeIntegration: true,
  },
});

win.loadURL('https://example.com');
```

```tsx
<webview src="https://example.com" nodeintegration />
```

## Correct

```ts
const win = new BrowserWindow({
  webPreferences: {
    preload: path.join(app.getAppPath(), 'preload.js'),
  },
});

win.loadURL('https://example.com');
```

```tsx
<webview src="https://example.com" />
```

## Notes

- Dynamic URLs
- Cross-file helper chasing
- Trust analysis for custom protocols

## How Options Are Resolved

The option bag does not have to be an inline literal. Within a single file the
rule follows `const` bindings and object spreads, so this is reported:

```ts
const prefs = { nodeIntegration: true };
new BrowserWindow({ webPreferences: prefs });
```

The rule stays silent where it cannot be certain:

- a `let` binding, which could be reassigned before the window is built
- an option bag passed to unknown code, which could retain or mutate it
- `{ ...opaque }` appearing after the option, since the spread could override it
- a computed key that is not a literal
- an option bag imported from another module
