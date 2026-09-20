import express from 'express';
import {
  applyDemoScenario,
  getDashboard,
} from '../modules/monitoring/index.js';
import { listScenarios } from '../modules/simulation/index.js';
import { listIncidents, markInvestigating } from '../modules/incidents/index.js';
import { listEvents } from '../services/events.js';
import { handleUssd, handleUssdNotification, listDemoUssdPhones, getLastUssdCallback } from '../modules/ussd/index.js';
import { config } from '../config/index.js';
import {
  sendSms,
  verifyAfricaTalking,
  getLastSms,
  listRecentSms,
  recordDeliveryReport,
} from '../integrations/africastalking/sms.js';
import {
  listTechnicians,
  getTechnician,
  createTechnician,
  updateTechnician,
  setTechnicianActive,
  listServiceAreasDetailed,
  setAreaTechnicianAssignments,
  technicianNotifications,
} from '../modules/technicians/index.js';
import { normalizeUgPhone, isValidUgPhone } from '../modules/technicians/phone.js';

export const api = express.Router();

api.get('/health', async (_req, res, next) => {
  try {
    const africastalking = await verifyAfricaTalking();
    res.json({
      ok: africastalking.ok || africastalking.mode === 'mock',
      service: 'IncidentBridge',
      simulation_mode: true,
      africastalking,
      ussd: {
        callback: '/ussd',
        events: '/ussd/events',
        last: getLastUssdCallback(),
      },
      sms: {
        send: '/api/sms/send',
        delivery: '/sms/delivery',
        last: getLastSms(),
      },
    });
  } catch (error) {
    next(error);
  }
});

api.get('/africastalking/status', async (_req, res, next) => {
  try {
    res.json(await verifyAfricaTalking());
  } catch (error) {
    next(error);
  }
});

async function sendTestSms(req, res, next) {
  try {
    const to = req.body?.to || config.africastalking.alertPhone;
    const message =
      req.body?.message || 'IncidentBridge test message from the sandbox.';
    if (!to) {
      res.status(400).json({
        status: 'FAILED',
        detail: 'No recipient. Pass { to } or set AT_ALERT_PHONE.',
      });
      return;
    }
    const result = await sendSms({ to, message, purpose: req.body?.purpose || 'manual_test' });
    res.status(result.status === 'FAILED' ? 502 : 200).json(result);
  } catch (error) {
    next(error);
  }
}

api.post('/sms/test', sendTestSms);
api.post('/sms/send', sendTestSms);

api.get('/sms/last', (_req, res) => {
  res.json({ last: getLastSms() });
});

api.get('/sms/recent', async (req, res, next) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 20;
    res.json(await listRecentSms(limit));
  } catch (error) {
    next(error);
  }
});

api.get('/technicians', async (req, res, next) => {
  try {
    const includeInactive = req.query.includeInactive !== 'false';
    res.json(await listTechnicians({ includeInactive }));
  } catch (error) {
    next(error);
  }
});

api.post('/technicians', async (req, res, next) => {
  try {
    const technician = await createTechnician(req.body || {});
    res.status(201).json(technician);
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

api.get('/technicians/:id', async (req, res, next) => {
  try {
    const technician = await getTechnician(req.params.id);
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }
    res.json(technician);
  } catch (error) {
    next(error);
  }
});

api.put('/technicians/:id', async (req, res, next) => {
  try {
    const technician = await updateTechnician(req.params.id, req.body || {});
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }
    res.json(technician);
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

api.patch('/technicians/:id/status', async (req, res, next) => {
  try {
    const technician = await setTechnicianActive(req.params.id, req.body?.active !== false);
    if (!technician) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }
    res.json(technician);
  } catch (error) {
    next(error);
  }
});

api.get('/technicians/:id/notifications', async (req, res, next) => {
  try {
    const payload = await technicianNotifications(req.params.id);
    if (!payload) {
      res.status(404).json({ error: 'Technician not found' });
      return;
    }
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

api.get('/service-areas', async (_req, res, next) => {
  try {
    res.json(await listServiceAreasDetailed());
  } catch (error) {
    next(error);
  }
});

api.put('/service-areas/:id/technicians', async (req, res, next) => {
  try {
    const assignments = await setAreaTechnicianAssignments(
      req.params.id,
      req.body?.assignments || [],
    );
    res.json({ service_area_id: req.params.id, assignments });
  } catch (error) {
    if (error.status) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
});

api.post('/phones/normalize', (req, res) => {
  const phone = req.body?.phone;
  if (!isValidUgPhone(phone)) {
    res.status(400).json({ error: 'Invalid Ugandan mobile number', phone });
    return;
  }
  res.json({ phone: normalizeUgPhone(phone) });
});

api.get('/dashboard', async (_req, res, next) => {
  try {
    res.json(await getDashboard());
  } catch (error) {
    next(error);
  }
});

api.get('/incidents', async (req, res, next) => {
  try {
    const includeResolved = req.query.includeResolved !== 'false';
    res.json(await listIncidents({ includeResolved }));
  } catch (error) {
    next(error);
  }
});

api.post('/incidents/:id/investigate', async (req, res, next) => {
  try {
    const incident = await markInvestigating(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found or already resolved' });
      return;
    }
    res.json(incident);
  } catch (error) {
    next(error);
  }
});

api.get('/events', async (_req, res, next) => {
  try {
    res.json(await listEvents(50));
  } catch (error) {
    next(error);
  }
});

api.get('/simulation/scenarios', (_req, res) => {
  res.json(listScenarios());
});

api.post('/simulation/scenario', async (req, res, next) => {
  try {
    const scenario = req.body?.scenario;
    const state = await applyDemoScenario(scenario);
    res.json(state);
  } catch (error) {
    if (error.message?.startsWith('Unknown scenario')) {
      res.status(400).json({ error: error.message });
      return;
    }
    next(error);
  }
});

api.get('/ussd/demo-phones', async (_req, res, next) => {
  try {
    res.json(await listDemoUssdPhones());
  } catch (error) {
    next(error);
  }
});

function sendUssdResponse(res, response, hop) {
  res.status(200);
  res.setHeader('Content-Type', 'text/plain');
  if (hop) res.setHeader('at-ussd-hop-metadata', hop);
  res.end(response);
}

function ussdFromRequest(req) {
  const body = req.body || {};
  const query = req.query || {};
  return {
    sessionId: body.sessionId || body.session_id || query.sessionId,
    phoneNumber: body.phoneNumber || body.phone_number || query.phoneNumber || '',
    text: body.text ?? query.text ?? '',
    serviceCode: body.serviceCode || body.service_code || query.serviceCode,
  };
}

async function ussdHandler(req, res) {
  console.log('[ussd:request]', req.method, req.headers['content-type'] || '-', JSON.stringify(req.body || {}));
  try {
    const payload = ussdFromRequest(req);
    const { response, hop } = await handleUssd(payload);
    sendUssdResponse(res, response, hop);
  } catch (error) {
    console.error('[ussd:error]', error);
    sendUssdResponse(res, 'END Temporary error. Please try again.', 'error');
  }
}

async function ussdEventHandler(req, res) {
  console.log('[ussd:event]', JSON.stringify(req.body || {}));
  try {
    await handleUssdNotification(req.body || {});
    res.status(200);
    res.setHeader('Content-Type', 'text/plain');
    res.end('OK');
  } catch (error) {
    console.error('[ussd:event-error]', error);
    res.status(200);
    res.setHeader('Content-Type', 'text/plain');
    res.end('OK');
  }
}

function ussdLiveHandler(_req, res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/plain');
  res.end('IncidentBridge USSD callback is live. Africa\'s Talking should POST sessionId, phoneNumber and text here.');
}

function smsDeliveryLiveHandler(_req, res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/plain');
  res.end('IncidentBridge SMS delivery-report callback is live. Africa\'s Talking should POST reports here.');
}

async function smsDeliveryHandler(req, res) {
  console.log('[sms:delivery-request]', JSON.stringify(req.body || {}));
  try {
    await recordDeliveryReport(req.body || {});
  } catch (error) {
    console.error('[sms:delivery-error]', error);
  }
  res.status(200);
  res.setHeader('Content-Type', 'text/plain');
  res.end('OK');
}

api.get('/ussd', ussdLiveHandler);
api.get('/ussd/last', (_req, res) => {
  res.json({ last: getLastUssdCallback() });
});
api.post('/ussd', ussdHandler);
api.post('/ussd/events', ussdEventHandler);
api.get('/sms/delivery', smsDeliveryLiveHandler);
api.post('/sms/delivery', smsDeliveryHandler);

export {
  ussdHandler,
  ussdEventHandler,
  ussdLiveHandler,
  smsDeliveryHandler,
  smsDeliveryLiveHandler,
};
