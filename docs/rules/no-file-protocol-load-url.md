# no-file-protocol-load-url

Maps to Electron recommendation 18: "Avoid file:// and prefer custom protocols".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends serving local content from a custom protocol instead of
`file://`. Custom protocols behave more like normal web URLs and let the app keep
much tighter control over what can be loaded.

## What It Flags

- `loadURL()` calls that use a literal `file://...` URL
- `<webview src="file://...">`

## Incorrect

```ts
import { BrowserWindow } from 'electron';

const win = new BrowserWindow();
win.loadURL('file:///Users/me/app/index.html');
```

```tsx
<webview src="file:///Users/me/app/index.html" />
```

## Correct

```ts
const win = new BrowserWindow();
win.loadURL('app://index.html');
```

## Notes

- `loadFile(...)`
- dynamic URL construction
- protocol registration quality checks
