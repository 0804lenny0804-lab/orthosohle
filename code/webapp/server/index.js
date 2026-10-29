import { createApp } from './app.js';
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Ungültiger PORT');
createApp({ demo: process.env.DEMO_MODE === 'true' }).listen(port, '127.0.0.1', () => {
  console.log(`Lokale OrthoSohle-API: http://127.0.0.1:${port}`);
});
