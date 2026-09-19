# IncidentBridge

Detect. Localize. Route. Inform.

IncidentBridge is a distributed network incident detection and response prototype for ISPs and organisations that operate fibre infrastructure across multiple service areas.

When connectivity fails, operators often know that something is down but still need to answer:

1. Where along the path connectivity stopped
2. Which service area is affected
3. Which customers may be affected
4. Which technician is responsible
5. How the failure can still be reported if the primary path is unavailable
6. How customers can check service status without relying on internet access

This hackathon MVP demonstrates that loop with **simulated** edge monitoring agents, failure-domain localization, impact analysis, technician routing, SMS alerts and USSD status queries.

**Network telemetry and cellular fallback are simulated.** The prototype is not connected to production routers, OLTs or customer networks.

## Problem

A core-to-edge fibre network can fail in more than one place. A single “internet is down” alarm hides the difference between:

- a local access problem
- an area-to-core path problem
- a shared upstream internet problem
- observations that are too contradictory to localize

IncidentBridge localizes a **failure domain**. It does not invent a physical root cause such as a fibre cut.

## Architecture

Modular monolith: one repository, one backend application, one Postgres database.

```
simulator → observations → localization engine
        → consecutive-failure threshold
        → correlation
        → incident + impact + technician routing
        → SMS (Africa's Talking or mock)
        → NOC dashboard + USSD
```

Replace the simulation module later with real monitoring agents posting the same observation shape:

```
local_access_reachable
core_reachable
internet_reachable
timestamp
```

## Technology stack

- Backend: Node.js, Express
- Database: PostgreSQL
- Frontend: React, TypeScript, Vite, Tailwind CSS, Lucide
- Messaging: Africa's Talking SMS and USSD, with a mock SMS provider when credentials are absent

## Install

```bash
docker compose up -d postgres
cp .env.example backend/.env   # already created for local demo
cd backend && npm install
cd ../frontend && npm install
```

Postgres is exposed on `localhost:5435` so it does not collide with other local databases.

## Run backend

```bash
cd backend
npm start
```

API: [http://localhost:4000/api/health](http://localhost:4000/api/health)

Schema and seed data are applied on startup.

## Run frontend

```bash
cd frontend
npm run dev
```

Dashboard: [http://localhost:5173](http://localhost:5173)

The Vite dev server proxies `/api` and `/ussd` to the backend.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `PORT` | Backend port (default `4000`) |
| `MONITOR_INTERVAL_MS` | Simulated probe interval (default `2000`) |
| `FAILURE_THRESHOLD` | Consecutive failed checks before an incident (default `3`) |
| `RECOVERY_THRESHOLD` | Consecutive successful checks before resolve (default `3`) |
| `AT_USERNAME` | Africa's Talking username. Use `sandbox` in the AT sandbox. Use the live app username in production. |
| `AT_API_KEY` | Africa's Talking API key from the dashboard. Sent as the `apiKey` request header. Never committed. |
| `AT_SENDER_ID` | Optional live sender ID / short code (`from`). Not sent in sandbox. |

Leave `AT_API_KEY` empty to keep SMS in mock mode.

## Africa's Talking integration

SMS is sent only for **HIGH** or **CRITICAL** incidents, to the assigned technician.

Authentication follows Africa's Talking's API docs:

- `apiKey` is sent as a request header
- `username` is sent in the `application/x-www-form-urlencoded` body
- `Accept: application/json`
- Sandbox username `sandbox` posts to `https://api.sandbox.africastalking.com/version1/messaging`
- Any other username posts to `https://api.africastalking.com/version1/messaging`

If `AT_USERNAME` and `AT_API_KEY` are set, the backend calls Africa's Talking. The dashboard shows `SENT` only when AT returns HTTP 200/201 **and** a successful recipient status. A rejected number or invalid key is `FAILED`. It never reports a successful send unless Africa's Talking accepted the message.

If the API key is missing, the mock provider logs the message and the dashboard shows `SIMULATED`.

To enable sandbox SMS:

1. Generate an API key in the Africa's Talking dashboard
2. Put it in `backend/.env` as `AT_API_KEY=...` with `AT_USERNAME=sandbox`
3. Restart the backend
4. Confirm `GET /api/health` shows `"mode": "africastalking"` and `"environment": "sandbox"`

Sandbox messages are delivered to the Africa's Talking simulator, not live phones, unless you switch to a production username and key.

USSD follows the Africa's Talking callback pattern.

Session callback (configure this as the USSD callback URL):

- `POST /ussd`
- `POST /api/ussd`

Africa's Talking sends `sessionId`, `serviceCode`, `phoneNumber` and `text` as form fields. The first request has empty `text`. Later requests concatenate choices with `*` (for example `1`). Responses are `text/plain` and start with `CON` (continue) or `END` (terminal). Each response includes the `at-ussd-hop-metadata` header so AT can build `hopsMetadata`.

End-of-session notification (configure this as the USSD event notification URL):

- `POST /ussd/events`
- `POST /api/ussd/events`

That endpoint accepts the AT form fields (`date`, `sessionId`, `serviceCode`, `networkCode`, `phoneNumber`, `status`, `cost`, `durationInMillis`, `hopsCount`, `hopsMetadata`, `input`, `lastAppResponse`, `errorMessage`) and records them. It does not send a USSD menu back.

Demo subscriber map:

- `256700000001` → Mukono A
- `256700000002` → Mukono B

Menu:

```
IncidentBridge
1. Check my service status
2. Report a problem
```

## Simulation mode

Demo buttons **do not create incidents**. They change simulated reachability. The monitoring loop then emits observations, the localization engine classifies them, and incidents appear only after the consecutive-failure threshold.

When an area cannot use its primary path, the UI shows out-of-band reporting as **ACTIVE / simulated cellular**. That is a prototype of an independent cellular backhaul, not real GSM hardware.

## Demo scenarios

Wait about 6 seconds after clicking a failure (3 probes × 2 seconds). Restore the same way.

| Control | Expected result |
| --- | --- |
| Fail Mukono A uplink | `AREA_CORE_PATH_FAILURE`, 67 customers potentially affected, Mukono A technician, simulated SMS, simulated cellular fallback |
| Fail upstream internet | **One** shared `UPSTREAM_CONNECTIVITY_FAILURE`, 125 customers potentially affected, NOC engineer |
| Fail Mukono A local access | `LOCAL_ACCESS_FAILURE`, Mukono A technician |
| Ambiguous failure | `UNDETERMINED` — “Failure location could not be confidently determined. Engineer investigation required.” |
| Restore network | After 3 successful checks, incident becomes `RESOLVED` with duration |

Use the USSD demo on the dashboard with the Mukono A number during an A-side incident to see the active-incident message.

## Tests

```bash
cd backend
npm test
```

Coverage includes healthy path, area-to-core failure, upstream failure, local access failure, unknown state, shared upstream correlation, and recovery threshold.

## Known prototype limitations

- Edge agents, fibre telemetry and cellular fallback are simulated
- No production SNMP, OLT, AAA or CRM integration
- No authentication or RBAC
- Consecutive counters live in process memory (incidents persist in Postgres)
- SMS uses a mock provider unless Africa's Talking credentials are provided
- Customer records are fictional and contain only enough data for impact mapping and USSD demos

## Future production architecture

- Replace `modules/simulation` with real agents at the edge
- Keep the same observation contract and localization engine
- Host the API off-network so agents can report over cellular when the fibre uplink fails
- Connect Africa's Talking (or equivalent) for operator SMS and customer USSD
- Add durable probe history, on-call calendars and change-management context
- Still report failure domains, not unverified physical root causes
