# no-raw-electron-api-exposure

Maps to Electron recommendation 20: "Do not expose Electron APIs to untrusted web content".

Source: https://www.electronjs.org/docs/latest/tutorial/security

## Electron Guidance

Electron recommends exposing narrow, capability-based preload APIs instead of raw
Electron primitives. In particular, raw IPC APIs and raw event objects can expose
far more power than the renderer should have.

## What It Flags

- exposing `ipcRenderer` directly through `contextBridge.exposeInMainWorld()`
- exposing other raw Electron APIs such as `shell` or `clipboard`
- exposing raw `ipcRenderer` members such as `ipcRenderer.on`
- preload wrappers that pass the raw IPC `event` object through to renderer callbacks

## Incorrect

```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer,
  on: ipcRenderer.on,
});
```

```ts
import { contextBridge, shell } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  shell,
});
```

```ts
const on = (channel: string, callback: (...args: unknown[]) => void) => {
  ipcRenderer.on(channel, (event, ...args) => callback(event, ...args));
};
```

## Correct

```ts
contextBridge.exposeInMainWorld('electron', {
  send: (channel: string, payload: unknown) => ipcRenderer.send(channel, payload),
  onMessage: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
});
```
