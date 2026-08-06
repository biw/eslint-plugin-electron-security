# no-open-external-with-dynamic-url

Maps to Electron recommendation 15: "Do not use shell.openExternal with untrusted content".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron warns that `shell.openExternal()` can be dangerous when it receives
untrusted input. Unsafe usage can hand control to native apps or platform handlers
with attacker-controlled arguments.

## What It Flags

- `shell.openExternal(...)` calls with non-literal URLs
- Literal URLs that do not use an allowlisted protocol

## Allowed Literal Protocols

- `https:`
- `mailto:`
- `tel:`

## Incorrect

```ts
import { shell } from 'electron';

shell.openExternal(userSuppliedUrl);
shell.openExternal('http://example.com');
```

## Correct

```ts
shell.openExternal('https://example.com/account');
shell.openExternal('mailto:support@example.com');
```

## Options

### `allowedProtocols`

Protocols accepted for literal URLs. Defaults to `https:`, `mailto:` and `tel:`.
Entries may be written with or without the trailing colon.

```js
{
  'electron-security/no-open-external-with-dynamic-url': [
    'error',
    { allowedProtocols: ['https:', 'slack:'] },
  ],
}
```

### `urlValidators`

Functions that validate a URL. Naming yours here lets the rule recognise a
validated dynamic URL instead of forcing a permanent `eslint-disable` comment.

```js
{
  'electron-security/no-open-external-with-dynamic-url': [
    'error',
    { urlValidators: ['parseOpenableExternalUrl', 'isHttpUrl'] },
  ],
}
```

Three shapes are recognised. A validator may be used inline:

```ts
await shell.openExternal(parseOpenableExternalUrl(targetUrl));
```

Or derived from a validator:

```ts
const parsedUrl = parseOpenableExternalUrl(targetUrl);
if (parsedUrl === null) throw new Error('Only http(s) URLs are allowed');
await shell.openExternal(parsedUrl.toString());
```

Gated by a validator that bails out:

```ts
if (!isHttpUrl(url)) {
  throw new Error('Only http and https URLs can be opened.');
}
await shell.openExternal(url);
```

A guard that does not `throw` or `return`, or that checks a different variable
than the one being opened, is still reported. Reassigning the value after a
validator call or accepted guard invalidates that trust.

### `trustedUrlType`

Requires a type-aware parser. Name a branded type and the compiler enforces the
taint path for you — across file boundaries, which no syntactic check can do.

```js
{
  'electron-security/no-open-external-with-dynamic-url': [
    'error',
    { trustedUrlType: 'ValidatedUrl' },
  ],
}
```

```ts
type ValidatedUrl = string & { readonly __brand: unique symbol };

declare function parseExternalUrl(raw: string): ValidatedUrl | null;

const open = (raw: string) => {
  const url = parseExternalUrl(raw);
  if (url === null) throw new Error('rejected');
  shell.openExternal(url); // accepted: the type proves it was validated
};
```

A plain `string`, or a value carrying a different brand, is still reported. The
brand is matched by name, whether it comes from a type alias, the type's own
symbol, or a member of an intersection.

This is the strongest signal the rule has: `urlValidators` trusts that a named
function validates, whereas a brand is checked by `tsc`. The caveat is that an
`as ValidatedUrl` assertion defeats it — pair this with
`@typescript-eslint/no-unsafe-type-assertion` if that matters to you.

## Notes

The rule does not implement full taint tracking, domain allowlists, or cross-file
trust analysis. `urlValidators` is an explicit statement of trust by the project:
the rule confirms the validator ran over the same value, not that the validator
is correct.
