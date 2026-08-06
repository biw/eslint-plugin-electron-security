# require-factory

A structural rule. It does not map to a numbered item on Electron's checklist —
it is the mechanism that makes several of the numbered items checkable.

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Why This Rule Exists

Most of this plugin's harder rules have to answer questions of the form "did you
remember to do the safe thing?" — did every `ipcMain` handler validate its
sender, did every window get safe `webPreferences`. Proving that from syntax is
not possible in general, so those rules are heuristics, and heuristics have false
positives and false negatives.

This rule changes the question. Instead of checking every call site for evidence
of safety, route the API through one wrapper your project owns and check that
nobody bypasses it. "Is there a raw `ipcMain.handle` outside `src/security/`?" is
a question with an exact answer.

The wrapper is yours. This plugin does not ship one and does not need to know
what it does.

## Configuration

The rule is inert until configured, so enabling it costs nothing up front.

```js
{
  'electron-security/require-factory': ['error', {
    factories: [
      { api: 'ipcMain.handle', use: 'handleSecure', allowIn: ['src/security/ipc.ts'] },
      { api: 'ipcMain.on', use: 'handleSecure', allowIn: ['src/security/ipc.ts'] },
      { api: 'BrowserWindow', use: 'createSecureWindow', allowIn: ['src/security/windows.ts'] },
      { api: 'shell.openExternal', use: 'openExternalSafe', allowIn: ['src/security/urls.ts'] },
    ],
  }],
}
```

### `api`

Either a supported constructor (`BaseWindow`, `BrowserView`, `BrowserWindow`,
`Menu`, `MenuItem`, `MessageChannelMain`, `Notification`, `ShareMenu`,
`TouchBar`, `Tray`, `View`, or `WebContentsView`) or a `namespace.method` call
such as `ipcMain.handle` or `shell.openExternal`. Unknown bare constructor names
are rejected by the option schema instead of being silently ignored.

Aliased imports, namespace imports and `require('electron')` destructuring are
all resolved, so renaming the import does not evade the rule.

### `use`

Optional. The wrapper name to suggest in the message.

### `allowIn`

Files permitted to call the API directly — normally just the wrapper itself. A
bare path such as `src/security/ipc.ts` matches as a suffix, so it works
regardless of where the project root sits. `*` and `**` are supported.

## Incorrect

```ts
// src/backend/runtime.ts
import { ipcMain } from 'electron';

ipcMain.handle('save', (event, payload) => payload);
```

## Correct

```ts
// src/security/ipc.ts — the one place the raw API is allowed
import { ipcMain } from 'electron';

export const handleSecure = (channel: string, handler: Handler) =>
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event, channel);
    return handler(event, ...args);
  });
```

```ts
// src/backend/runtime.ts
import { handleSecure } from '../security/ipc';

handleSecure('save', (event, payload) => payload);
```

## Notes

This rule proves that the wrapper is the only door. It does not and cannot prove
that the wrapper is implemented correctly — but that moves the security-critical
logic into one small reviewable file instead of spreading it across every call
site, which is the point.

Pairs well with `require-ipc-sender-validation`: point that rule at your wrapper
with `senderGuards`, and it will verify the wrapper itself validates.
