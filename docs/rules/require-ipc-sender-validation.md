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

## Notes

This rule uses same-file heuristics. It can see obvious checks and obvious missing
checks, but it does not prove that a helper implements the right allowlist.
