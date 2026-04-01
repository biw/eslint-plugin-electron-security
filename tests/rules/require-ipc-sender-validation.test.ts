import rule from '../../src/rules/require-ipc-sender-validation';
import { ruleTester } from '../rule-tester';

ruleTester.run('require-ipc-sender-validation', rule, {
  valid: [
    {
      code: `
        import { ipcMain } from 'electron';

        ipcMain.handle('save', (event, payload) => {
          validateSender(event);
          return payload;
        });
      `,
    },
    {
      code: `
        import * as electron from 'electron';

        electron.ipcMain.on('ping', (event) => {
          if (event.senderFrame?.url !== 'https://example.com') {
            return;
          }
        });
      `,
    },
  ],
  invalid: [
    {
      code: `
        import { ipcMain } from 'electron';

        ipcMain.handle('save', (_event, payload) => payload);
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      code: `
        import { ipcMain } from 'electron';

        ipcMain.handle('save', (event, payload) => {
          const senderUrl = event.senderFrame?.url || 'unknown';
          console.log(senderUrl);
          return payload;
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      code: `
        import { ipcMain } from 'electron';

        const handlePing = (event, payload) => {
          console.log(event, payload);
        };

        ipcMain.on('ping', handlePing);
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
    {
      code: `
        import { ipcMain } from 'electron';

        ipcMain.on('ping', (event) => {
          console.log(event.senderFrame?.url);
        });
      `,
      errors: [{ messageId: 'missingSenderValidation' }],
    },
  ],
});
