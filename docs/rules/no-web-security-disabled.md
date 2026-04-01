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
