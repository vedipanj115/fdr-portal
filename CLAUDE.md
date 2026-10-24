# Project notes for Claude Code

## What this is
SIH 2026 project for problem statement SIH26265 (AICTE): a portal to manage security-deposit FDRs (Fixed Deposit Receipts) that AICTE-approved institutions lodge with AICTE. Institutions upload FDRs, Scrutiny Officers verify them, AICTE Admins monitor everything. The system tracks maturity dates, sends reminders, handles renewals and refund requests, and keeps a hash-chained audit log.

## Roles in the app
- **Institution** — uploads FDRs, renews them, requests refunds.
- **Scrutiny Officer** — verifies FDRs using the Trust Card, approves / rejects / asks for correction.
- **AICTE Admin** — dashboard of all FDRs, audit log, Time Machine demo mode.

## Stack
- `frontend/`: React 18 + Vite + Tailwind CSS v4 + React Router + Recharts. Plain JavaScript (JSX), no TypeScript.
- `backend/`: Node.js + Express, PostgreSQL.
- `automation/`: Python (OCR with Tesseract/EasyOCR, rules, scheduler, mock bank API).

## Rules
- Frontend uses mock data first. All data access goes through `frontend/src/api/client.js`; pages never import mock data directly.
- Field names must match `docs/api-contract.md` exactly.
- Indian formats: dates like `25 Oct 2026`, money as ₹ with lakh/crore grouping (use `utils/format.js`).
- Colour meaning is fixed: green = verified/active, amber = needs attention/expiring, red = mismatch/expired.
- Government-portal look: white background, navy primary, clean tables, no gradients.
- Work on a feature branch and open PRs into `dev`. Never push to `main`.
- Never commit secrets or `.env` files.
- Each folder has one owner (see `.github/CODEOWNERS`); don't change another person's folder without telling them.
