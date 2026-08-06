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

## How Options Are Resolved

The option bag does not have to be an inline literal. Within a single file the
rule follows `const` bindings and object spreads, so this is reported:

```ts
const prefs = { allowRunningInsecureContent: true };
new BrowserWindow({ webPreferences: prefs });
```

The rule stays silent where it cannot be certain:

- a `let` binding, which could be reassigned before the window is built
- an option bag passed to unknown code, which could retain or mutate it
- `{ ...opaque }` appearing after the option, since the spread could override it
- a computed key that is not a literal
- an option bag imported from another module
