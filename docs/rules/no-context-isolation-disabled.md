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

## How Options Are Resolved

The option bag does not have to be an inline literal. Within a single file the
rule follows `const` bindings and object spreads, so this is reported:

```ts
const prefs = { contextIsolation: false };
new BrowserWindow({ webPreferences: prefs });
```

The rule stays silent where it cannot be certain:

- a `let` binding, which could be reassigned before the window is built
- an option bag passed to unknown code, which could retain or mutate it
- `{ ...opaque }` appearing after the option, since the spread could override it
- a computed key that is not a literal
- an option bag imported from another module
