import rule from '../../src/rules/require-permission-request-handler';
import { ruleTester } from '../rule-tester';

ruleTester.run('require-permission-request-handler', rule, {
  valid: [
    {
      name: 'handler branches on the requested permission',
      code: `
        import { BrowserWindow, session } from 'electron';

        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
          if (permission === 'media') {
            callback(true);
            return;
          }

          callback(false);
        });

        const win = new BrowserWindow();
        win.loadURL('https://example.com');
      `,
    },
    {
      name: 'handler passes a computed allowlist check to the callback',
      code: `
        import { session } from 'electron';

        const ALLOWED = new Set(['clipboard-read']);

        session.fromPartition('persist:remote').setPermissionRequestHandler((wc, permission, callback) => {
          callback(ALLOWED.has(permission));
        });

        wc.loadURL('https://example.com');
      `,
    },
    {
      name: 'handler denies everything',
      code: `
        import { session } from 'electron';

        session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
          callback(false);
        });

        wc.loadURL('https://example.com');
      `,
    },
    {
      name: 'handler uses an early-return guard before granting',
      code: `
        import { session } from 'electron';

        const ALLOWED_ORIGINS = new Set(['https://example.com']);

        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
          if (!ALLOWED_ORIGINS.has(new URL(webContents.getURL()).origin)) {
            return callback(false);
          }

          callback(true);
        });

        webContents.loadURL('https://example.com');
      `,
    },
    {
      name: 'handler grants through a ternary on the permission name',
      code: `
        import { session } from 'electron';

        session.defaultSession.setPermissionRequestHandler((wc, permission, callback) =>
          permission === 'notifications' ? callback(true) : callback(false),
        );

        wc.loadURL('https://example.com');
      `,
    },
    {
      name: 'handler grants inside a nested closure, which is not analyzable',
      code: `
        import { session } from 'electron';

        session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
          checkWithUser(permission).then((approved) => callback(true));
        });

        wc.loadURL('https://example.com');
      `,
    },
    {
      name: 'no session usage at all, only remote content',
      code: `
        import { BrowserWindow } from 'electron';

        const win = new BrowserWindow();
        win.loadURL('https://example.com');
      `,
    },
    {
      name: 'session usage but only local content',
      code: `
        import { BrowserWindow, session } from 'electron';

        const partitioned = session.fromPartition('persist:local');
        const win = new BrowserWindow({ webPreferences: { session: partitioned } });

        win.loadFile('index.html');
      `,
    },
    {
      name: 'webPreferences partition with a custom protocol load',
      code: `
        import { BrowserWindow } from 'electron';

        const win = new BrowserWindow({ webPreferences: { partition: 'persist:app' } });

        win.loadURL('app://index.html');
      `,
    },
    {
      name: 'session identifier is not imported from electron',
      code: `
        import { session } from './my-session';

        session.defaultSession.doSomething();

        win.loadURL('https://example.com');
      `,
    },
    {
      name: 'handler installed via an unresolvable imported callback',
      code: `
        import { session } from 'electron';

        import { permissionHandler } from './permissions';

        session.defaultSession.setPermissionRequestHandler(permissionHandler);

        win.loadURL('https://example.com');
      `,
    },
    {
      name: 'requireHandler disabled keeps quiet about a missing handler',
      code: `
        import { session } from 'electron';

        const ses = session.fromPartition('persist:remote');

        win.loadURL('https://example.com');
      `,
      options: [{ requireHandler: false }],
    },
    {
      name: 'missing handler but no remote literal to prove remote content',
      code: `
        import { session } from 'electron';

        const ses = session.fromPartition('persist:remote');

        win.loadURL(computeStartUrl());
      `,
    },
    {
      name: 'an unrelated protocol-shaped object does not imply remote Electron content',
      code: `
        import { session } from 'electron';
        const protocol = {
          registerSchemesAsPrivileged() {},
        };
        protocol.registerSchemesAsPrivileged([]);
        session.fromPartition('persist:remote');
      `,
    },
    {
      name: 'an unrelated permission handler call is ignored',
      code: `
        const permissions = {
          setPermissionRequestHandler(handler: unknown) {},
        };
        permissions.setPermissionRequestHandler((wc: unknown, permission: string, callback: (allow: boolean) => void) => {
          callback(true);
        });
      `,
    },
    {
      name: 'a mutable variable that once held a session is not trusted as a session receiver',
      code: `
        import { session } from 'electron';
        let current = session.defaultSession;
        current = {
          setPermissionRequestHandler() {},
        };
        current.setPermissionRequestHandler((wc, permission, callback) => {
          callback(true);
        });
      `,
    },
    {
      name: 'a BrowserWindow webContents session handler satisfies the requirement',
      code: `
        import { BrowserWindow } from 'electron';
        const win = new BrowserWindow({ webPreferences: { partition: 'persist:remote' } });
        win.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
          callback(false);
        });
        win.loadURL('https://example.com');
      `,
    },
    {
      name: 'a mutable Session binding still records its installed handler',
      code: `
        import { session } from 'electron';
        let ses = session.fromPartition('persist:remote');
        ses.setPermissionRequestHandler((wc, permission, callback) => {
          callback(false);
        });
        win.loadURL('https://example.com');
      `,
    },
    {
      name: 'a canonically assigned mutable BrowserWindow exposes its Session',
      code: `
        import { BrowserWindow } from 'electron';
        let mainWindow;
        mainWindow = new BrowserWindow({ webPreferences: { partition: 'persist:remote' } });
        mainWindow.webContents.session.setPermissionRequestHandler((wc, permission, callback) => {
          callback(false);
        });
        mainWindow.loadURL('https://example.com');
      `,
    },
    {
      name: 'namespace-imported session with a handler satisfies the requirement',
      code: `
        import * as electron from 'electron';
        electron.session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
          callback(false);
        });
        mainWindow.loadURL('https://example.com');
      `,
    },
    {
      name: 'require()-aliased session with a handler satisfies the requirement',
      code: `
        const { session: ses } = require('electron');
        ses.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
          callback(false);
        });
        mainWindow.loadURL('https://example.com');
      `,
    },
  ],
  invalid: [
    {
      // Regression: keying "loads content" purely off http(s) URLs made this
      // rule silent on apps that followed Electron's advice to serve the
      // renderer over a custom protocol.
      name: 'privileged custom scheme registered alongside a session, but no handler',
      code: `
        import { protocol, session } from 'electron';

        protocol.registerSchemesAsPrivileged([
          { scheme: 'app', privileges: { standard: true, secure: true } },
        ]);

        const ses = session.fromPartition('persist:main');
        ses.setProxy({});
      `,
      errors: [{ messageId: 'missingPermissionHandler' }],
    },
    {
      name: 'unconditional callback(true) on the default session',
      code: `
        import { session } from 'electron';

        session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
          callback(true);
        });

        webContents.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'unconditionalPermissionGrant' }],
    },
    {
      name: 'unconditional callback(true) as a concise arrow body',
      code: `
        import { session } from 'electron';

        session.fromPartition('persist:remote').setPermissionRequestHandler((wc, permission, callback) =>
          callback(true),
        );
      `,
      errors: [{ messageId: 'unconditionalPermissionGrant' }],
    },
    {
      name: 'unconditional grant through an aliased handler function',
      code: `
        import * as electron from 'electron';

        const allowEverything = (webContents, permission, callback) => {
          console.log(permission);
          callback(true);
        };

        electron.session.defaultSession.setPermissionRequestHandler(allowEverything);
      `,
      errors: [{ messageId: 'unconditionalPermissionGrant' }],
    },
    {
      name: 'unconditional grant with a require() destructured session',
      code: `
        const { session } = require('electron');

        session.defaultSession.setPermissionRequestHandler(function (wc, permission, callback) {
          callback(true);
        });
      `,
      errors: [{ messageId: 'unconditionalPermissionGrant' }],
    },
    {
      name: 'missing handler with fromPartition and an https load',
      code: `
        import { BrowserWindow, session } from 'electron';

        const remote = session.fromPartition('persist:remote');
        const win = new BrowserWindow({ webPreferences: { session: remote } });

        win.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'missingPermissionHandler' }],
    },
    {
      name: 'missing handler with the default session and an http load',
      code: `
        import { session } from 'electron';

        session.defaultSession.setUserAgent('demo');

        win.loadURL('http://example.com');
      `,
      errors: [{ messageId: 'missingPermissionHandler' }],
    },
    {
      name: 'missing handler with a webPreferences partition and a remote load',
      code: `
        import { BrowserWindow } from 'electron';

        const win = new BrowserWindow({ webPreferences: { partition: 'persist:remote' } });

        win.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'missingPermissionHandler' }],
    },
    {
      name: 'missing handler reports once for several session references',
      code: `
        import { session } from 'electron';

        const first = session.fromPartition('persist:one');
        const second = session.fromPartition('persist:two');

        first.webRequest.onCompleted(() => {});
        win.loadURL('https://example.com');
        other.loadURL('https://example.org');
      `,
      errors: [{ messageId: 'missingPermissionHandler' }],
    },
    {
      name: 'unconditional grant reported even when requireHandler is disabled',
      code: `
        import { session } from 'electron';

        session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
          callback(true);
        });

        win.loadURL('https://example.com');
      `,
      options: [{ requireHandler: false }],
      errors: [{ messageId: 'unconditionalPermissionGrant' }],
    },
    {
      name: 'unconditional grant using a namespace session with an extra statement',
      code: `
        import * as electron from 'electron';

        electron.session
          .fromPartition('persist:remote')
          .setPermissionRequestHandler((webContents, permission, callback) => {
            logPermission(permission);
            callback(true);
          });

        win.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'unconditionalPermissionGrant' }],
    },
    {
      name: 'an unrelated permission handler cannot suppress a required Electron handler',
      code: `
        import { session } from 'electron';
        const unrelated = { setPermissionRequestHandler() {} };
        unrelated.setPermissionRequestHandler(() => {});
        session.fromPartition('persist:remote');
        win.loadURL('https://example.com');
      `,
      errors: [{ messageId: 'missingPermissionHandler' }],
    },
  ],
});
