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

## How Options Are Resolved

The option bag does not have to be an inline literal. Within a single file the
rule follows `const` bindings and object spreads, so this is reported:

```ts
const prefs = { enableBlinkFeatures: 'PreciseMemoryInfo' };
new BrowserWindow({ webPreferences: prefs });
```

The rule stays silent where it cannot be certain:

- a `let` binding, which could be reassigned before the window is built
- an option bag passed to unknown code, which could retain or mutate it
- `{ ...opaque }` appearing after the option, since the spread could override it
- a computed key that is not a literal
- an option bag imported from another module
