# require-csp

Maps to Electron recommendation 7: "Define a Content Security Policy".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends defining a Content Security Policy for any content the app
loads, either through `session.defaultSession.webRequest.onHeadersReceived` or a
`<meta>` tag. A CSP is a second line of defence: even if an attacker manages to
inject markup, a restrictive policy stops the injected script from running.

A policy that permits inline or evaluated script through `default-src` or
`script-src`, or opens either directive to `*`, gives up most of that
protection. `style-src 'unsafe-inline'` is not a script-execution finding.
When `script-src` is present it replaces the `default-src` fallback for script;
the rule checks that effective directive rather than combining both.

## What It Flags

- `webRequest.onHeadersReceived` callbacks that assemble a `responseHeaders`
  object literal with no `Content-Security-Policy` key (matched
  case-insensitively)
- Policy strings containing `'unsafe-inline'` or `'unsafe-eval'` in
  `default-src` or `script-src`, wherever the rule can attribute them to a CSP:
  a `Content-Security-Policy` header value, or a
  `<meta http-equiv="Content-Security-Policy">` tag
- Policy strings whose `default-src` or `script-src` is a bare `*`

## Incorrect

```ts
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'X-Frame-Options': ['DENY'],
    },
  });
});
```

```ts
const headers = {
  'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'unsafe-inline'"],
};
```

```tsx
<meta http-equiv="Content-Security-Policy" content="default-src *" />
```

## Correct

```ts
session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
  callback({
    responseHeaders: {
      ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'"],
    },
  });
});
```

```tsx
<meta
  httpEquiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self' https://cdn.example.com"
/>
```

## Options

### `allowUnsafeInline`

Do not report `'unsafe-inline'` in a Content Security Policy. Defaults to
`false`. Use this only while migrating inline scripts to hashes or nonces.

```js
{
  'electron-security/require-csp': ['error', { allowUnsafeInline: true }],
}
```

### `allowUnsafeEval`

Do not report `'unsafe-eval'` in a Content Security Policy. Defaults to `false`.
Use this only when a dependency genuinely requires runtime evaluation.

```js
{
  'electron-security/require-csp': ['error', { allowUnsafeEval: true }],
}
```

Each option is independent: with `allowUnsafeInline` on, a policy that also
permits `'unsafe-eval'` is still reported.

## Notes

This rule reports only on evidence it can see in the current file. Whether an app
defines a CSP *somewhere* cannot be decided per file, so the rule never claims a
policy is missing outright — it reports a missing header only when it can see
response headers being assembled without one.

Several shapes are deliberately left alone rather than reported:

- A `responseHeaders` object that spreads anything other than
  the actual callback parameter's `details.responseHeaders`, or uses a dynamic
  key, could be setting the policy out of sight
- An `onHeadersReceived` callback that hands header assembly to a helper
- A policy value the rule cannot read statically, such as a call result or an
  interpolated template (mutable `let` and `var` initializers are not followed)
- `Content-Security-Policy-Report-Only`, which does not enforce anything

Policy strings are parsed simply: split on `;`, then split each directive on
whitespace.
