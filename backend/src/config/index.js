import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function integer(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
}

function text(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

const atUsername = text('AT_USERNAME');
const atApiKey = text('AT_API_KEY');
const atEnvironment = atUsername.toLowerCase() === 'sandbox' ? 'sandbox' : 'live';

export const config = {
  port: integer('PORT', 4000),
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://incidentbridge:incidentbridge@localhost:5435/incidentbridge',
  monitorIntervalMs: integer('MONITOR_INTERVAL_MS', 2000),
  failureThreshold: integer('FAILURE_THRESHOLD', 3),
  recoveryThreshold: integer('RECOVERY_THRESHOLD', 3),
  africastalking: {
    username: atUsername,
    apiKey: atApiKey,
    senderId: text('AT_SENDER_ID'),
    environment: atUsername ? atEnvironment : null,
    alertPhone: text(
      'AT_ALERT_PHONE',
      atEnvironment === 'sandbox' ? '+256787106109' : '',
    ),
  },
};

export function africastalkingConfigured() {
  return Boolean(config.africastalking.username && config.africastalking.apiKey);
}

export function africastalkingStatus() {
  const { username, senderId, environment, alertPhone } = config.africastalking;
  const configured = africastalkingConfigured();
  return {
    configured,
    environment: username ? environment : null,
    username: username || null,
    sender_id_configured: Boolean(senderId),
    alert_phone: alertPhone || null,
    mode: configured ? 'africastalking' : 'mock',
  };
}
