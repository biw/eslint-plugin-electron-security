# no-enable-blink-features

Maps to Electron recommendation 10: "Do not use enableBlinkFeatures".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

`enableBlinkFeatures` turns on Chromium rendering features that were disabled by
default. Electron's guidance is to avoid enabling Blink features speculatively and
only turn them on if you fully understand the security impact.

## What It Flags

- Any `enableBlinkFeatures` option in Electron window configuration

## Incorrect

```ts
new BrowserWindow({
  webPreferences: {
    enableBlinkFeatures: 'PreciseMemoryInfo',
  },
});
```

## Correct

```ts
new BrowserWindow();
```
