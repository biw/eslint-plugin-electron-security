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

## How Options Are Resolved

The option bag does not have to be an inline literal. Within a single file the
rule follows `const` bindings and object spreads, so this is reported:

```ts
const prefs = { experimentalFeatures: true };
new BrowserWindow({ webPreferences: prefs });
```

The rule stays silent where it cannot be certain:

- a `let` binding, which could be reassigned before the window is built
- an option bag passed to unknown code, which could retain or mutate it
- `{ ...opaque }` appearing after the option, since the spread could override it
- a computed key that is not a literal
- an option bag imported from another module
