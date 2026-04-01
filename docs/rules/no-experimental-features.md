# no-experimental-features

Maps to Electron recommendation 9: "Do not enable experimental features".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron exposes Chromium experimental features, but those features are not broadly
tested and may change security behavior in ways most apps do not expect.

## What It Flags

- `experimentalFeatures: true` in Electron window option bags

## Incorrect

```ts
new BrowserWindow({
  webPreferences: {
    experimentalFeatures: true,
  },
});
```

## Correct

```ts
new BrowserWindow({});
```
