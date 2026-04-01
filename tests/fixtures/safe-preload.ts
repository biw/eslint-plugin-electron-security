import { contextBridge, ipcRenderer } from 'electron';

const api = {
  send: (channel: string, payload: unknown) => ipcRenderer.send(channel, payload),
  onMessage: (channel: string, callback: (...args: unknown[]) => void) => {
    ipcRenderer.on(channel, (_event: unknown, ...args: unknown[]) => callback(...args));
  },
};

contextBridge.exposeInMainWorld('electron', api);
