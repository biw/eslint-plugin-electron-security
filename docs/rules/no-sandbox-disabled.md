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
