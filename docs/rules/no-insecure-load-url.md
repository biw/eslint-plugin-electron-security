# no-insecure-load-url

Maps to Electron recommendation 1: "Only load secure content".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends loading remote resources over secure transport. Secure protocols
help protect integrity and confidentiality while content is in transit.

## What It Flags

- `loadURL()` calls on Electron window handles when the URL literal uses `http:`, `ws:`, or `ftp:`
- `<webview src="...">` when the `src` literal uses an insecure protocol

## Incorrect

```ts
import { BrowserWindow } from 'electron';

const win = new BrowserWindow();
win.loadURL('http://example.com');
```

```tsx
<webview src="ws://example.com/socket" />
```

## Correct

```ts
const win = new BrowserWindow();
win.loadURL('https://example.com');
```

```tsx
<webview src="https://example.com/app" />
```

## Notes

- URLs assembled through variables
- Cross-file tracing
- Non-Electron methods that merely happen to be named `loadURL`
