# no-allow-running-insecure-content

Maps to Electron recommendation 8: "Do not enable allowRunningInsecureContent".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron blocks HTTPS pages from loading insecure subresources by default. Turning
`allowRunningInsecureContent` on disables that protection and makes mixed-content
execution possible.

## What It Flags

- `allowRunningInsecureContent: true` in Electron window option bags

## Incorrect

```ts
new BrowserWindow({
  webPreferences: {
    allowRunningInsecureContent: true,
  },
});
```

## Correct

```ts
new BrowserWindow({
  webPreferences: {
    allowRunningInsecureContent: false,
  },
});
```

```ts
new BrowserWindow({});
```
