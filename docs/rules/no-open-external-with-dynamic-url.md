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

## Notes

- Taint tracking
- Domain allowlists
- Cross-file trust analysis
