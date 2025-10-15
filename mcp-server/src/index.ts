import 'dotenv/config';
import { buildServer } from './server.js';
import { loadConfig } from './config.js';

const cfg = loadConfig();
const app = buildServer(cfg);

app.listen({ port: cfg.port, host: '0.0.0.0' }).then(() => {
  (app.log as any).info(`Server started on :${cfg.port}`);
}).catch((err) => {
  (app.log as any).error(err, 'Failed to start server');
  process.exit(1);
});
