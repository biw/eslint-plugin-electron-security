# require-window-open-handler

Maps to Electron recommendation 14: "Disable or limit creation of new windows".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends registering a window-open handler and denying unexpected window
creation. New windows are another common way for untrusted content to gain a larger
surface area or reach destinations you did not intend.

## What It Flags

- `setWindowOpenHandler(() => ({ action: 'allow' }))`
- Alias callbacks that unconditionally return `{ action: 'allow' }`

## Incorrect

```ts
contents.setWindowOpenHandler(() => ({ action: 'allow' }));
```

## Correct

```ts
contents.setWindowOpenHandler(({ url }) => {
  if (isSafeForExternalOpen(url)) {
    setImmediate(() => {
      shell.openExternal(url);
    });
  }

  return { action: 'deny' };
});
```

## Notes

This rule only flags obviously permissive handlers. It does not prove that every
window-open path in the app is correctly allowlisted.
