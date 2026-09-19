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
app.use(cors());
app.use(express.json());
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
  res.status(500).json({ error: 'Internal server error' });
});

async function main() {
  await waitForDatabase();
  await migrate();
  await seedIfEmpty();
  await alignAfricaTalkingRecipients();

  app.listen(config.port, () => {
    console.log(`[incidentbridge] API listening on http://localhost:${config.port}`);
    console.log('[incidentbridge] Network telemetry and cellular fallback are SIMULATED');
    logSmsProvider();
  });

  await processTick();
  setInterval(() => {
    processTick().catch((error) => console.error('[monitor]', error));
  }, config.monitorIntervalMs);
}

main().catch((error) => {
  console.error('[fatal]', error);
  pool.end().finally(() => process.exit(1));
});
