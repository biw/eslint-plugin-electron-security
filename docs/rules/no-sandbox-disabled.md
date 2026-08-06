# no-sandbox-disabled

Maps to Electron recommendation 4: "Enable process sandboxing".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends sandboxing every renderer. Unsandboxed renderers have a much
larger OS-level attack surface, and Electron notes that disabling context isolation
also disables sandboxing for that renderer.

## What It Flags

- `sandbox: false` in Electron window option bags

## Incorrect

```ts
new BrowserWindow({
  webPreferences: {
    sandbox: false,
  },
});
```

## Correct

```ts
new BrowserWindow({
  webPreferences: {
    sandbox: true,
  },
});
```

## How Options Are Resolved

The option bag does not have to be an inline literal. Within a single file the
rule follows `const` bindings and object spreads, so this is reported:

```ts
const prefs = { sandbox: false };
new BrowserWindow({ webPreferences: prefs });
```

The rule stays silent where it cannot be certain:

- a `let` binding, which could be reassigned before the window is built
- an option bag passed to unknown code, which could retain or mutate it
- `{ ...opaque }` appearing after the option, since the spread could override it
- a computed key that is not a literal
- an option bag imported from another module
