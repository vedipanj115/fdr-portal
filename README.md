# AICTE – Streamlined Deposit & FDR Portal (SDFP)

Smart India Hackathon 2026 · Problem statement **SIH26265** · AICTE · Smart Automation

A working prototype that manages the security deposits and FDRs of AICTE-approved institutions, from submission and independent bank confirmation through maturity tracking to release with an NOC.

> Prototype. Not an official AICTE website. All institutions, people and bank records are fictional demo data.

## Run it

You need **Node.js 22.13 or newer** (it uses Node's built-in SQLite).

```bash
npm install
npm run build      # builds the web app into dist/
npm start          # API + database + scheduler on http://localhost:8080
```

Or with Docker:

```bash
cp .env.example .env
docker compose up --build
```

The database (`data/sdfp.db`) is created and seeded on first start. `npm run reset-db` deletes it so the next start re-seeds.

### Demo accounts (password `Demo@123`)

| Portal | ID | Notes |
|---|---|---|
| AICTE officer | `AICTE-RB-1024` | OTP required; in demo mode it is shown on screen |
| Institution | shown on the sign-in page ("Fill demo details") | no OTP |
| Bank maker | `SBIN-MKR-01` | fetches from core banking, prepares |
| Bank checker | `SBIN-CHK-01` | signs with OTP |

## What runs where

| Part | Technology |
|---|---|
| Web app | React 18, TypeScript, Vite, Recharts, pdf.js, jsPDF, Tesseract.js (OCR, runs in the browser), jsQR |
| API | Node.js, Express, Zod validation, Helmet security headers, rate limiting |
| Database | SQLite (Node built-in), WAL mode; audit table is append-only via triggers |
| Auth | bcrypt password hashes, JWT in an httpOnly cookie, OTP for officers and banks (hashed, 5-minute expiry, 5 tries), lockout after 5 failed sign-ins |
| Encryption | AES-256-GCM for deposit and user records and every uploaded document |
| Automation | node-cron: nightly maturity scan (02:00 IST), weekly summary, delivery worker; nodemailer for email, webhook for SMS |
| External systems | Bank core banking (CBS), AICTE approval register and payment gateway, as separate HTTP services with API keys (`server/mocks.ts`). Replacing a mock with the real endpoint is a configuration change. |
| Analytics | Rule engine for flags and alerts; Isolation Forest for unusual deposits (no labelled data needed) |

Every change goes through one permission-checked action layer (`src/lib/actions.ts`). The same code runs on the server and in the offline demo, so the rules are identical in both.

## Offline demo

`dist/index.html` also works on its own, opened straight from disk: the same actions run in the browser and data is kept in local storage. Use this for a quick look or when there is no server; use `npm start` for the real system.

## Tests

With the server running: `node tests/api_test.mjs` (49 checks covering auth, OTP, RBAC, encryption, every workflow, automation and audit tamper detection).

## Project layout

```
server/      index.ts (API, auth, scheduler), db.ts (SQLite), crypto.ts (AES/keys), mocks.ts (bank, AICTE, gateway)
src/lib/     actions.ts (all business actions), rules.ts (lifecycle, flags, alerts), automation.ts (scan),
             anomaly.ts (Isolation Forest), docgen.ts (PDFs), ocr.ts, pdf.ts, qr.ts, store.tsx (client state)
src/pages/   officer/, institution/, bank/, Login, Shield (public check), DepositDetail
```
