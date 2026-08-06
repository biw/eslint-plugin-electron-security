# no-web-security-disabled

Maps to Electron recommendation 6: "Do not disable webSecurity".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron treats `webSecurity` as a core browser defense. Disabling it weakens the
same-origin model and also turns on insecure-content behavior that production apps
should avoid.

## What It Flags

- `webSecurity: false` in Electron window option bags
- `<webview disablewebsecurity>`

## Incorrect

```ts
new BrowserWindow({
  webPreferences: {
    webSecurity: false,
  },
});
```

```tsx
<webview disablewebsecurity />
```

## Correct

```ts
new BrowserWindow();
```

```tsx
<webview src="page.html" />
```

## How Options Are Resolved

The option bag does not have to be an inline literal. Within a single file the
rule follows `const` bindings and object spreads, so this is reported:

```ts
const prefs = { webSecurity: false };
new BrowserWindow({ webPreferences: prefs });
```

The rule stays silent where it cannot be certain:

- a `let` binding, which could be reassigned before the window is built
- an option bag passed to unknown code, which could retain or mutate it
- `{ ...opaque }` appearing after the option, since the spread could override it
- a computed key that is not a literal
- an option bag imported from another module
