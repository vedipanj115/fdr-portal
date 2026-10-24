# FDR Portal — SIH26265 (Team Debuggers!)

Smart India Hackathon 2026 · Problem Statement **SIH26265** (AICTE) — *Streamline of Security Deposit / FDR Portal* · Theme: Smart Automation · Category: Software

One portal where AICTE-approved institutions submit their security-deposit FDRs (Fixed Deposit Receipts), AICTE officers verify them, and the system tracks expiry, renewals and refunds automatically, with a tamper-evident audit trail.

## Core ideas

- **Trust Card** — every FDR field shown as *Claimed* (by institution) vs *Extracted* (OCR) vs *Bank-verified* (mock bank API), with a match status per field.
- **Lifecycle state machine** — Submitted → Under Scrutiny → Verified / Correction Requested → Active → Expiring → Renewed / Refund Requested → Refunded.
- **Automated reminders & escalation** — alerts at 90 / 60 / 30 / 7 days before maturity; escalation to the admin if unresolved.
- **Hash-chained audit log** — every action is linked to the previous one, so tampering is detectable.
- **Time Machine mode** — jump the system clock forward to demo expiries and reminders live.

## Repo layout

| Folder | What | Owner |
| --- | --- | --- |
| `frontend/` | React + Vite + Tailwind web app | Vedika |
| `backend/` | Node/Express REST API | Preet |
| `db/` | PostgreSQL schema + seed data | Preet |
| `automation/` | OCR, mismatch rules, reminder scheduler, mock bank API | Hetakshi |
| `docs/research/` | AICTE handbook clauses, circulars, evidence | Janhavi |
| `docs/diagrams/` | Architecture, lifecycle, ER diagrams (draw.io + PNG) | Ananay |
| `docs/video/` | Video script and assets | Ananay |
| `docs/ppt/` | Idea deck drafts, final PDF, screenshots | Aarohi |
| `docs/api-contract.md` | The agreed API between frontend and backend | Preet + Vedika |

## Run the frontend

```bash
cd frontend
npm install
npm run dev        # opens http://localhost:5173
```

The frontend runs on mock data (`frontend/src/data/mockFdrs.js`) until the backend is ready. All backend calls go through `frontend/src/api/client.js`.

## Run the backend (skeleton)

```bash
cd backend
npm install
npm run dev        # http://localhost:4000/health
```

## How we work

1. Pull `dev` → create a branch (`feat/frontend-upload-fdr`) → commit small → open a PR into `dev`.
2. One approval needed. CODEOWNERS requests the folder owner automatically.
3. Aarohi merges `dev` → `main` before demos and submissions.
4. Never commit `.env`, passwords, API keys or `node_modules/`.

Commit prefixes: `feat` · `fix` · `docs` · `style` · `chore`.

## Team

Aarohi Limaye (lead) · Janhavi · Preet · Vedika · Hetakshi · Ananay
