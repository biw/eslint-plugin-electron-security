import rule from '../../src/rules/require-csp';
import { ruleTester } from '../rule-tester';

const jsx = {
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
} as const;

ruleTester.run('require-csp', rule, {
  valid: [
    {
      name: 'strict policy set from onHeadersReceived',
      code: `
        import { session } from 'electron';

        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': ["default-src 'self'"],
            },
          });
        });
      `,
    },
    {
      name: 'strict policy with an explicit script-src allowlist',
      code: `
        const headers = {
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self' https://cdn.example.com; object-src 'none'",
        };
      `,
    },
    {
      name: 'strict policy in a meta tag',
      code: `<meta httpEquiv="Content-Security-Policy" content="default-src 'self'" />;`,
      ...jsx,
    },
    {
      name: 'unsafe-inline permitted by the allowUnsafeInline option',
      code: `
        const headers = {
          'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'"],
        };
      `,
      options: [{ allowUnsafeInline: true }],
    },
    {
      name: 'unsafe-eval permitted by the allowUnsafeEval option',
      code: `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-eval'" />;`,
      options: [{ allowUnsafeEval: true }],
      ...jsx,
    },
    {
      name: 'file with no CSP-related code at all',
      code: `
        import { BrowserWindow } from 'electron';

        const win = new BrowserWindow({ webPreferences: { contextIsolation: true } });
        win.loadURL('https://example.com');
      `,
    },
    {
      name: 'onHeadersReceived that delegates header assembly to a helper',
      code: `
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback(withSecurityHeaders(details));
        });
      `,
    },
    {
      name: 'onHeadersReceived that merges an opaque header object',
      code: `
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: { ...details.responseHeaders, ...securityHeaders },
          });
        });
      `,
    },
    {
      name: 'onHeadersReceived that sets the CSP header under a computed key',
      code: `
        const CSP_HEADER = 'Content-Security-Policy';

        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: { ...details.responseHeaders, [CSP_HEADER]: [policy] },
          });
        });
      `,
    },
    {
      name: 'wildcard on a directive that cannot load script',
      code: `
        const headers = { 'Content-Security-Policy': "default-src 'self'; img-src *" };
      `,
    },
    {
      name: 'unsafe-inline in style-src does not make script execution unsafe',
      code: `
        const headers = {
          'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'",
        };
      `,
    },
    {
      name: 'explicit script-src overrides an unsafe default-src fallback',
      code: `
        const headers = {
          'Content-Security-Policy': "default-src * 'unsafe-inline'; script-src 'self'",
        };
      `,
    },
    {
      name: 'the first script-src wins when a policy repeats the directive',
      code: `
        const headers = {
          'Content-Security-Policy': "script-src 'self'; script-src * 'unsafe-inline'",
        };
      `,
    },
    {
      name: 'a mutable policy binding is not resolved from its stale initializer',
      code: `
        let policy = "default-src * 'unsafe-inline'";
        policy = "default-src 'self'";
        headers['Content-Security-Policy'] = policy;
      `,
    },
    {
      name: 'wildcard host pattern is not a bare wildcard source',
      code: `
        const headers = { 'Content-Security-Policy': "default-src https://*.example.com" };
      `,
    },
    {
      name: 'report-only header is not an enforced policy',
      code: `
        const headers = {
          'Content-Security-Policy-Report-Only': ["default-src 'self' 'unsafe-inline'"],
        };
      `,
    },
    {
      name: 'unresolvable policy value is left alone',
      code: `
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': [buildPolicy(details.url)],
            },
          });
        });
      `,
    },
    {
      name: 'unrelated onHeadersReceived-shaped call is ignored',
      code: `
        const service = { webRequest: { onHeadersReceived() {} } };
        service.webRequest.onHeadersReceived((details, callback) => {
          callback({ responseHeaders: { 'X-Frame-Options': ['DENY'] } });
        });
      `,
    },
    {
      name: 'a spread from another responseHeaders object remains opaque',
      code: `
        import { session } from 'electron';
        declare const base: { responseHeaders: Record<string, string[]> };
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: { ...base.responseHeaders, 'X-Frame-Options': ['DENY'] },
          });
        });
      `,
    },
  ],
  invalid: [
    {
      name: 'unsafe-inline in a header policy',
      code: `
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'"],
            },
          });
        });
      `,
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'unsafe-eval in a header policy',
      code: `
        const headers = {
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-eval'",
        };
      `,
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'wildcard default-src',
      code: `const headers = { 'Content-Security-Policy': "default-src *" };`,
      errors: [{ messageId: 'wildcardCspDirective' }],
    },
    {
      name: 'wildcard script-src',
      code: `const headers = { 'Content-Security-Policy': "default-src 'self'; script-src *" };`,
      errors: [{ messageId: 'wildcardCspDirective' }],
    },
    {
      name: 'onHeadersReceived builds response headers without a CSP',
      code: `
        import { session } from 'electron';
        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: {
              ...details.responseHeaders,
              'X-Frame-Options': ['DENY'],
            },
          });
        });
      `,
      errors: [{ messageId: 'missingCspHeader' }],
    },
    {
      name: 'onHeadersReceived with a filter argument builds headers without a CSP',
      code: `
        import { session } from 'electron';
        const handleHeaders = (details, callback) => {
          callback({ responseHeaders: { 'X-Content-Type-Options': ['nosniff'] } });
        };

        session.fromPartition('persist:app').webRequest.onHeadersReceived(
          { urls: ['*://*/*'] },
          handleHeaders,
        );
      `,
      errors: [{ messageId: 'missingCspHeader' }],
    },
    {
      name: 'the callback details parameter may use a name other than details',
      code: `
        import { session } from 'electron';
        session.defaultSession.webRequest.onHeadersReceived((response, callback) => {
          callback({
            responseHeaders: { ...response.responseHeaders, 'X-Frame-Options': ['DENY'] },
          });
        });
      `,
      errors: [{ messageId: 'missingCspHeader' }],
    },
    {
      name: 'namespace-imported Electron session is recognised',
      code: `
        import * as electron from 'electron';
        electron.session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({ responseHeaders: { ...details.responseHeaders, 'X-Frame-Options': ['DENY'] } });
        });
      `,
      errors: [{ messageId: 'missingCspHeader' }],
    },
    {
      name: 'require()-aliased Electron session is recognised',
      code: `
        const { session: ses } = require('electron');
        ses.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({ responseHeaders: { ...details.responseHeaders, 'X-Frame-Options': ['DENY'] } });
        });
      `,
      errors: [{ messageId: 'missingCspHeader' }],
    },
    {
      name: 'a mutable BrowserWindow webContents session response handler without CSP',
      code: `
        import { BrowserWindow } from 'electron';
        let win;
        win = new BrowserWindow();
        win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
          callback({ responseHeaders: { 'X-Frame-Options': ['DENY'] } });
        });
      `,
      errors: [{ messageId: 'missingCspHeader' }],
    },
    {
      name: 'meta tag with http-equiv and unsafe-inline',
      code: `<meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline'" />;`,
      ...jsx,
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'meta tag with httpEquiv and unsafe-eval',
      code: `<meta httpEquiv="content-security-policy" content="script-src 'unsafe-eval'" />;`,
      ...jsx,
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'unsafe-eval still reported when only unsafe-inline is allowed',
      code: `
        const headers = {
          'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        };
      `,
      options: [{ allowUnsafeInline: true }],
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'policy held in a local constant',
      code: `
        const policy = "default-src 'self'; script-src 'unsafe-inline'";

        session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
          callback({
            responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] },
          });
        });
      `,
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'a chain of local constants resolves to an unsafe policy',
      code: `
        const rawPolicy = "default-src 'self'; script-src 'unsafe-eval'";
        const policy = rawPolicy;
        headers['Content-Security-Policy'] = policy;
      `,
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'unsafe-inline in a script-capable directive assigned onto a headers object',
      code: `
        headers['Content-Security-Policy'] = ["default-src 'self'; script-src 'unsafe-inline'"];
      `,
      errors: [{ messageId: 'unsafeCspDirective' }],
    },
    {
      name: 'wildcard and unsafe-inline in the same policy',
      code: `<meta httpEquiv="Content-Security-Policy" content="default-src * 'unsafe-inline'" />;`,
      ...jsx,
      errors: [{ messageId: 'unsafeCspDirective' }, { messageId: 'wildcardCspDirective' }],
    },
  ],
});
