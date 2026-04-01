# no-webview-allowpopups

Maps to Electron recommendation 11: "`<webview>`: do not use allowpopups".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends keeping popup creation off for webviews unless the embedded page
truly needs it. Allowing popups expands what untrusted content can do by default.

## What It Flags

- `<webview allowpopups>`
- `<webview allowpopups={true}>`

## Incorrect

```tsx
<webview src="https://example.com" allowpopups />
```

## Correct

```tsx
<webview src="https://example.com" />
```
