# require-permission-request-handler

Maps to Electron recommendation 5: "Use ses.setPermissionRequestHandler() in sessions that load remote content".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Chromium asks the embedder before granting a page access to the camera, the
microphone, the clipboard, notifications, and similar capabilities. Electron
grants nothing by default only if the app installs a handler; a session that
loads remote content and never calls `ses.setPermissionRequestHandler()` leaves
those decisions to whatever the remote page asks for. The handler should approve
a known set of permissions for a known set of origins, not everything.

## What It Flags

- `setPermissionRequestHandler` callbacks that unconditionally call their
  callback argument with a literal `true`
- Files that reference a session (`session.defaultSession`,
  `session.fromPartition()`, `session.fromPath()`, or a `webPreferences.session`
  / `webPreferences.partition` option) and load a literal `http:`/`https:` URL,
  but never call `setPermissionRequestHandler`

## Incorrect

```ts
import { session } from 'electron';

session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  callback(true);
});
```

```ts
import { BrowserWindow, session } from 'electron';

const remote = session.fromPartition('persist:remote');
const win = new BrowserWindow({ webPreferences: { session: remote } });

win.loadURL('https://example.com');
```

## Correct

```ts
import { session } from 'electron';

const ALLOWED_PERMISSIONS = new Set(['clipboard-read', 'notifications']);

session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
  if (new URL(webContents.getURL()).origin !== 'https://example.com') {
    return callback(false);
  }

  callback(ALLOWED_PERMISSIONS.has(permission));
});
```

## Options

```jsonc
{
  "electron-security/require-permission-request-handler": [
    "warn",
    {
      // Report sessions that load remote content but never call
      // setPermissionRequestHandler. Defaults to true.
      "requireHandler": true,
    },
  ],
}
```

Set `requireHandler` to `false` when the handler is installed in a file the rule
cannot see, for example a shared bootstrap module. The unconditional-grant check
stays active either way.

## Notes

The unconditional-grant check only fires on a straight line to
`callback(true)`: one call to the third parameter, a literal `true`, and no
branching in the body. A computed argument, several call sites, or a grant
issued from a nested closure all read as gated and are left alone.

The missing-handler check needs both a session reference and a literal remote
`loadURL` in the same file, and it reports once. It treats any
`setPermissionRequestHandler` call on a locally traceable Electron Session as
installing a handler, including `setPermissionRequestHandler(null)`, which
actually clears it. Session and BrowserWindow variables are followed through
their latest write before the call, including conventional mutable bindings.
These choices trade coverage for silence, because this rule reports the absence
of a mitigation and cannot prove that a pattern it does not recognise is unsafe.
