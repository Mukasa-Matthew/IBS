import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { waitForDatabase, pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { seedIfEmpty, alignAfricaTalkingRecipients } from './db/seed.js';
import { api, ussdHandler, ussdEventHandler, ussdLiveHandler, smsDeliveryHandler, smsDeliveryLiveHandler } from './api/index.js';
import { processTick } from './modules/monitoring/index.js';
import { logSmsProvider } from './integrations/africastalking/sms.js';

const app = express();
app.set('trust proxy', 1);

app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((v) => v.trim()),
  }),
);
app.use(express.json({
  verify: (req, _res, buf) => {
    if (buf?.length) req.rawBody = buf.toString('utf8');
  },
}));
app.use(express.urlencoded({ extended: false }));
app.use('/api', api);
app.get('/ussd', ussdLiveHandler);
app.post('/ussd', ussdHandler);
app.post('/ussd/events', ussdEventHandler);
app.get('/sms/delivery', smsDeliveryLiveHandler);
app.post('/sms/delivery', smsDeliveryHandler);

app.use((error, req, res, _next) => {
  console.error('[http]', error);
  if (req.path === '/ussd' || req.path === '/api/ussd' || req.path.startsWith('/ussd/')) {
    res.status(200);
    res.setHeader('Content-Type', 'text/plain');
    res.end('END Temporary error. Please try again.');
    return;
  }
  if (error?.type === 'entity.parse.failed' || error instanceof SyntaxError) {
    res.status(400).json({
      error: 'Invalid JSON body',
      detail: 'Send a valid JSON object. Example: {"to":"+256755032436","message":"Hello"}',
      received: typeof req.rawBody === 'string' ? req.rawBody.slice(0, 200) : undefined,
    });
    return;
  }
  res.status(500).json({ error: 'Internal server error' });
});

let monitorTimer = null;
let server = null;

async function main() {
  await waitForDatabase();
  await migrate();
  await seedIfEmpty();
  await alignAfricaTalkingRecipients();

  server = app.listen(config.port, config.host, () => {
    console.log(`[incidentbridge] API listening on http://${config.host}:${config.port}`);
    console.log(`[incidentbridge] env=${config.nodeEnv} simulation telemetry enabled`);
    logSmsProvider();
  });

  await processTick();
  monitorTimer = setInterval(() => {
    processTick().catch((error) => console.error('[monitor]', error));
  }, config.monitorIntervalMs);
}

async function shutdown(signal) {
  console.log(`[incidentbridge] ${signal} received, shutting down`);
  if (monitorTimer) clearInterval(monitorTimer);
  await new Promise((resolve) => {
    if (!server) {
      resolve();
      return;
    }
    server.close(() => resolve());
  });
  await pool.end().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    console.error('[fatal]', error);
    process.exit(1);
  });
});
process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    console.error('[fatal]', error);
    process.exit(1);
  });
});

main().catch((error) => {
  console.error('[fatal]', error);
  pool.end().finally(() => process.exit(1));
});
