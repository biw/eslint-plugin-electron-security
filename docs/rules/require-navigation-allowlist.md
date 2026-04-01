# require-navigation-allowlist

Maps to Electron recommendation 13: "Disable or limit navigation".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends blocking navigation entirely when an app does not need it, or
allowing only a known set of destinations. Navigation is a common way to push an
otherwise hardened app onto an attacker-controlled page.

## What It Flags

- `will-navigate` handlers that never call `event.preventDefault()`
- Alias callbacks passed to `on`, `once`, or `addListener` for `will-navigate`

## Incorrect

```ts
contents.on('will-navigate', (_event, url) => {
  console.log(url);
});
```

## Correct

```ts
contents.on('will-navigate', (event, navigationUrl) => {
  const parsedUrl = new URL(navigationUrl);

  if (parsedUrl.origin !== 'https://example.com') {
    event.preventDefault();
  }
});
```

## Notes

This rule checks visible blocking behavior in the handler. It does not prove that
every navigation path in the app is covered.
