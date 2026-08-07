# require-ipc-sender-validation

Maps to Electron recommendation 17: "Validate the sender of all IPC messages".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends validating the sender for every IPC message by default. Main
process handlers can receive messages from iframes, child windows, and other frames
that should not automatically be trusted.

## What It Flags

- `ipcMain.on(...)` or `ipcMain.handle(...)` handlers with no visible sender
  validation
- Alias callbacks that ignore the IPC event or never inspect / validate sender
  metadata

## Incorrect

```ts
ipcMain.handle('save', (_event, payload) => payload);
```

## Correct

```ts
ipcMain.handle('get-secrets', (event) => {
  if (!validateSender(event.senderFrame)) return null;
  return getSecrets();
});
```

```ts
function validateSender(frame: { url: string }) {
  return new URL(frame.url).host === 'electronjs.org';
}
```

## Options

### `senderGuards`

Function names that count as sender validation when the IPC event is passed to
them. Use this when your guard does not match the default naming heuristic.

```js
{
  'electron-security/require-ipc-sender-validation': [
    'error',
    { senderGuards: ['isTrustedRendererUrl'] },
  ],
}
```

By default a call counts as validation when its name begins with `assert`,
`authorize`, `can`, `check`, `ensure`, `guard`, `has`, `is`, `must`, `only`,
`require`, `restrict`, `validate` or `verify` **and** it receives the IPC event
or one of its sender properties.

## Type-Aware Behaviour

With a type-aware parser configured, a function **declared as a type guard or
assertion** counts as validation regardless of its name:

```ts
declare function frobnicate(event: unknown): event is TrustedEvent;
declare function frobnicate2(event: unknown): asserts event is TrustedEvent;
```

That is a fact about the signature rather than a naming convention, and unlike
the heuristic it resolves through imports — so a guard defined in another module
is verified rather than assumed. A plain `(event: unknown) => boolean` does not
qualify.

An assertion call must be a standalone statement before handler work. Type
narrowing starts only after the assertion executes, so a late assertion cannot
validate payload processing that already happened.

The rule degrades gracefully: without type information it falls back to the
naming heuristic, so the same configuration works in both modes.

## What Does Not Count

Two shapes look like validation but are rejected:

```ts
// The guard is declared in this file and never reads its parameters.
const validateNothing = (_event: unknown) => true;
ipcMain.handle('c', (event, payload) => {
  validateNothing(event);
  return payload;
});
```

```ts
// The conditional mentions the sender but does not gate anything: the work
// runs either way.
ipcMain.handle('f', (event, payload) => {
  if (event.senderFrame) {
    log('received');
  }
  return payload;
});
```

A conditional counts as a guard when it bails out with `throw`/`return`, or when
the remaining work lives inside it.

## Notes

This rule uses same-file heuristics. It can see obvious checks and obvious missing
checks, but it does not prove that a helper implements the right allowlist.

A guard imported from another module cannot be resolved, so it is trusted rather
than reported. That is a deliberate trade: a false positive here teaches teams to
disable the rule, which costs more than the missed warning.
