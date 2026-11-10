import { createAuth } from './auth.js';
import { createApp } from './app.js';
import { readConfig } from './config.js';

const config = readConfig();
const runtime = createAuth(config);
const server = createApp(runtime.auth, { database: runtime.database, webOrigin: config.webOrigin })
  .listen(config.port, '127.0.0.1', () => {
  console.log(`Local identity API: ${config.baseURL}`);
});
server.on('error', () => {
  runtime.close();
  console.error('Local identity API could not start.');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close(() => runtime.close());
  });
}
