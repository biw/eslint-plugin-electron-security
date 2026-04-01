# no-context-isolation-disabled

Maps to Electron recommendation 3: "Enable context isolation in all renderers".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends keeping preload code and renderer code in separate JavaScript
contexts. That isolation helps prevent renderer-controlled code from tampering with
objects and APIs that preload scripts rely on.

## What It Flags

- `contextIsolation: false` in Electron window option bags

## Incorrect

```ts
new BrowserWindow({
  webPreferences: {
    contextIsolation: false,
  },
});
```

## Correct

```ts
new BrowserWindow({
  webPreferences: {
    contextIsolation: true,
  },
});
```

```ts
new BrowserWindow({
  webPreferences: {
    preload: path.join(app.getAppPath(), 'preload.js'),
  },
});
```
