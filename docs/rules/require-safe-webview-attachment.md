# require-safe-webview-attachment

Maps to Electron recommendation 12: "`<webview>`: verify options and params".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends handling `will-attach-webview` in the host `webContents` and
using that event to strip dangerous settings and validate the URL before the webview
is created.

## What It Flags

- `will-attach-webview` handlers that neither block the attach nor sanitize
  `webPreferences`
- Handlers that never validate `params.src`
- Handlers that sanitize `webPreferences` but still allow arbitrary `params.src`

## Incorrect

```ts
contents.on('will-attach-webview', (_event, webPreferences, params) => {
  console.log(webPreferences, params.src);
});
```

## Correct

```ts
contents.on('will-attach-webview', (event, webPreferences, params) => {
  delete webPreferences.preload;
  webPreferences.nodeIntegration = false;

  if (!params.src.startsWith('https://example.com/')) {
    event.preventDefault();
  }
});
```

## Notes

This rule is heuristic. It checks for visible sanitization or visible blocking in
the same file, not full application-wide webview policy coverage.
