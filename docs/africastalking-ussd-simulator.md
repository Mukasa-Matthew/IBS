# Africa's Talking USSD simulator setup

This guide walks through testing IncidentBridge USSD with the **Africa's Talking sandbox simulator**. Network telemetry stays simulated; USSD callbacks are real AT session traffic hitting your API.

## What you need

1. Backend running on port `4000`
2. A **public HTTPS URL** that forwards to that port (AT cannot call `localhost`)
3. Africa's Talking sandbox account with a USSD channel / service code
4. The phone numbers below entered in the simulator

## 1. Start the API locally

```bash
docker compose up -d postgres
cd backend
cp ../.env.example .env   # if needed
# For sandbox USSD + sandbox SMS:
#   AT_USERNAME=sandbox
#   AT_API_KEY=<sandbox api key>
#   AT_ALERT_PHONE=+256755032436
npm start
```

Check:

```bash
curl -s http://127.0.0.1:4000/ussd
# → IncidentBridge USSD callback is live...
```

## 2. Expose the API to Africa's Talking

Use a temporary tunnel while developing (example with Cloudflare):

```bash
npx --yes cloudflared tunnel --url http://localhost:4000
```

Copy the `https://….trycloudflare.com` URL. That becomes your public base, e.g.:

```text
https://abc-xyz.trycloudflare.com
```

On a VPS, use your real domain instead of a tunnel.

## 3. Configure Africa's Talking dashboard

In the AT sandbox / USSD channel settings:

| Setting | Value |
| --- | --- |
| **Callback URL** (session) | `https://YOUR-PUBLIC-HOST/ussd` |
| **Event notification URL** | `https://YOUR-PUBLIC-HOST/ussd/events` |

Also valid (same handlers):

- `https://YOUR-PUBLIC-HOST/api/ussd`
- `https://YOUR-PUBLIC-HOST/api/ussd/events`

Notes:

- Method must be **POST**
- Content type from AT is form-urlencoded (`sessionId`, `serviceCode`, `phoneNumber`, `text`)
- First dial has empty `text`
- Later hops concatenate with `*` (e.g. `1`, then `1*IB-1059`)
- Responses are plain text starting with `CON` or `END`
- Do **not** put the Vite port (`5173`) in AT — callbacks must hit the API (`4000` via the tunnel)

Optional SMS delivery reports:

- `https://YOUR-PUBLIC-HOST/sms/delivery`

## 4. Phone numbers for the simulator

USSD menus are chosen from the **calling phone**, not from a shared menu.

### Customers (subscriber menu only)

| Phone (simulator) | Role | Site |
| --- | --- | --- |
| `256710000001` | Customer | Seeta |
| `256710005001` | Customer | Mukono Central |

Customer menu:

```text
IncidentBridge Customer
1. Check my service status
2. Report a problem
```

- Customers **cannot** acknowledge technician incidents (entering `IB-…` is rejected).
- Status reflects whether that customer's site has an open incident.

### Technicians (field / NOC menu only)

| Phone (simulator) | Role | Person |
| --- | --- | --- |
| `256788607860` | Technician | Magezi Richard (Seeta) |
| `256740724042` | Technician | Aisu Joshua (Nakifuma) |
| `256705660370` | Technician | Tarsis Mukiibi (Katosi) |
| `256787106109` | Technician | Elijah (Namataba) |
| `256791496003` | Technician | Paul (Ggulu) |
| `256755032436` | NOC / Technician | Matthew (Mukono Central) |

Technician menu:

```text
IncidentBridge Technician
1. Acknowledge incident
2. My open assignments
0. Exit
```

- Option **1** → prompt for SMS reference (`IB-1059` or `1059`) → sets incident to `INVESTIGATING` if the phone matches the assignee (or NOC).
- Option **2** → lists open assignments for that tech / NOC.
- Customer options are **not** shown on technician phones.

If a number is both a demo customer and a technician (Matthew), **technician wins**.

## 5. End-to-end simulator checklist

### A. Customer status during an outage

1. On the NOC dashboard → **Simulation** → Fail **Seeta** core uplink.
2. Wait ~6s for the incident (3 probes × 2s).
3. In the AT USSD simulator, set phone to `256710000001`.
4. Dial the service code → choose `1`.
5. Expect an `END` message mentioning the active incident and `Ref: IB-…`.

### B. Customer report (healthy site)

1. Restore network (or use a healthy site customer).
2. Simulator phone `256710005001` → menu → `2`.
3. Expect report reference + optional confirmation SMS in sandbox.

### C. Technician acknowledge by reference

1. Simulate a Seeta failure and wait for SMS / dashboard incident `IB-….`
2. Simulator phone `256788607860` (Magezi).
3. Menu → `1` → enter `IB-1059` (or just `1059`).
4. Expect `Acknowledged… Status set to INVESTIGATING`.
5. Dashboard incident status should show **INVESTIGATING**.

### D. Role isolation

1. Customer phone + text `IB-1059` → denied (not the tech menu).
2. Wrong technician phone + correct reference → denied (not assigned).

## 6. Local dashboard simulator (optional)

**Channels** page includes an in-app USSD panel that POSTs to `/api/ussd` with the same hop format. Use it when you do not need the AT UI; use the AT simulator when you want to prove the public callback path.

## 7. Verify callbacks are reaching you

```bash
# After a simulator dial:
curl -s http://127.0.0.1:4000/api/ussd/last | jq .

# Backend logs should show:
# [ussd:request] ...
# [ussd] role=CUSTOMER|TECHNICIAN ... hop=...
```

Health payload also lists callback paths:

```bash
curl -s http://127.0.0.1:4000/api/health | jq .ussd
```

## 8. Sandbox vs live

| Mode | `AT_USERNAME` | SMS delivery | USSD |
| --- | --- | --- | --- |
| Sandbox | `sandbox` | AT simulator inbox | AT USSD simulator → your callback URL |
| Live | app username (e.g. `Thewton`) | Real MSISDNs | Real handsets → your HTTPS callback |

USSD session handling is the same code path in both modes. Only SMS host/credentials and whether phones are real change.

## Troubleshooting

| Symptom | Likely fix |
| --- | --- |
| AT says callback failed / timeout | Tunnel down, wrong URL, or API not on `:4000` |
| Always get customer menu on a tech phone | Phone digits must match seeded tech MSISDN (`2567…`, no `+` in simulator is fine) |
| Ack says not assigned | Use the technician who received the SMS for that site |
| Empty / wrong menu | Confirm AT is POSTing to `/ussd`, not the Vite frontend |
| Port 1517 / blocked inbound | Use cloudflared (or VPS HTTPS); do not rely on AT reaching your LAN port |

## Related endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/ussd` | Liveness text for humans / AT URL check |
| `POST` | `/ussd` | Session callback (`CON` / `END`) |
| `POST` | `/ussd/events` | End-of-session notification |
| `GET` | `/api/ussd/last` | Last processed session (debug) |
| `GET` | `/api/ussd/demo-phones` | Demo MSISDNs + roles |
