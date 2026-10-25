# API Contract (draft — Preet + Vedika to finalise)

Base URL (local): `http://localhost:4000/api`
All responses are JSON. Auth: `Authorization: Bearer <token>` after login.
Dates are ISO strings (`2026-10-25`). Amounts are integers in rupees.

## FDR object

```json
{
  "id": "FDR-2026-0001",
  "institution": { "id": "INST-1-1234567", "name": "ABC Institute of Technology", "state": "Maharashtra" },
  "fdrNumber": "SBI/FD/0098123",
  "bankName": "State Bank of India",
  "branch": "Andheri East",
  "ifsc": "SBIN0001234",
  "amount": 10000000,
  "issueDate": "2024-07-01",
  "maturityDate": "2027-07-01",
  "status": "ACTIVE",
  "documentUrl": "/uploads/fdr-0001.pdf",
  "verification": {
    "fields": [
      { "field": "fdrNumber", "claimed": "SBI/FD/0098123", "extracted": "SBI/FD/0098123", "bank": "SBI/FD/0098123", "result": "MATCH" }
    ],
    "score": 6,
    "total": 6
  },
  "renewalOf": null,
  "renewedBy": null,
  "refundRequest": null,
  "createdAt": "2024-07-03T10:15:00Z",
  "updatedAt": "2026-10-20T09:00:00Z"
}
```

`status` ∈ `SUBMITTED`, `UNDER_SCRUTINY`, `CORRECTION_REQUESTED`, `ACTIVE`, `EXPIRING`, `EXPIRED`, `RENEWED`, `REFUND_REQUESTED`, `REFUNDED`, `REJECTED`

`verification.fields[].result` ∈ `MATCH`, `MISMATCH`, `MISSING`

- `renewalOf`: id of the FDR this one replaces (set on the new FDR by `POST /fdrs/:id/renew`), else `null`.
- `renewedBy`: id of the FDR that replaced this one (set on the old FDR, whose status becomes `RENEWED`), else `null`.
- `refundRequest`: `null`, or `{ "reason": "...", "requestedAt": "2026-10-22T11:25:00Z", "decision": null | "APPROVED" | "REJECTED", "remarks": null | "..." }`.

## Endpoints

| Method | Path | Who | Body / query | Returns |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | all | `{ email, password }` | `{ token, user: { id, name, role } }` |
| GET | `/fdrs` | all (filtered by role) | `?status=&search=&expiringInDays=` | `FDR[]` |
| GET | `/fdrs/:id` | all | — | `FDR` |
| POST | `/fdrs` | institution | multipart: fields + `document` file | `FDR` |
| POST | `/fdrs/:id/verify` | officer | `{ decision: "APPROVE" \| "REJECT" \| "CORRECTION", remarks }` | `FDR` |
| POST | `/fdrs/:id/renew` | institution | multipart: new FDR fields + file | the **new** `FDR` (`SUBMITTED`, `renewalOf` = `:id`); the old FDR becomes `RENEWED` with `renewedBy` set |
| POST | `/fdrs/:id/refund-request` | institution | `{ reason }` | `FDR` (status `REFUND_REQUESTED`) |
| POST | `/fdrs/:id/refund-decision` | officer | `{ decision: "APPROVE" \| "REJECT", remarks, checklist: { matured, noComplaints, documentReturned } }` | `FDR` (`REFUNDED`, or back to `ACTIVE` on reject). `APPROVE` needs all three checklist items `true`; `REJECT` needs `remarks` |
| GET | `/dashboard/stats` | admin | `?asOf=2027-01-01` (Time Machine) | `{ active, expiring30, expired, renewed, refunded, totalAmount, byState: [], byBank: [] }` |
| GET | `/audit-log` | admin | `?fdrId=` | `[{ id, at, actor, action, fdrId, hash, prevHash }]` |
| GET | `/audit-log/verify` | admin | — | `{ valid: true, entries: 412 }` |
| GET | `/notifications` | all (filtered by role) | `?asOf=2026-10-25&upcomingDays=90` (both optional, see below) | `[{ id, at, type, message, fdrId, read }]` |
| POST | `/notifications/:id/read` | all | — | `{ id, read: true }` |

## Audit actions

`action` values written to the audit log. The FDR lifecycle timeline (officer FDR detail and refund pages) is built from `GET /audit-log?fdrId=`, so the backend must log these exact names. Officers need read access to `/audit-log?fdrId=` for this, not just admins.

| Action | Actor | Logged when | Timeline stage |
| --- | --- | --- | --- |
| `FDR_SUBMITTED` | institution | Institution uploads a new FDR (`POST /fdrs`) | Submitted |
| `SCRUTINY_STARTED` | officer | An officer picks up the FDR for verification | Under scrutiny |
| `CORRECTION_REQUESTED` | officer | Officer asks the institution to correct details (`decision: "CORRECTION"`) | Under scrutiny (amber note) |
| `FDR_REJECTED` | officer | Officer rejects the FDR (`decision: "REJECT"`) | Under scrutiny (red note) |
| `FDR_APPROVED` | officer | Officer approves the FDR (`decision: "APPROVE"`) | Verified |
| `FDR_ACTIVATED` | system | FDR becomes active after approval (status `ACTIVE`) | Active |
| `REMINDER_30_SENT` | system | 30-day maturity reminder sent to the institution | Expiring |
| `FDR_EXPIRED` | system | Maturity date passed with no renewal or refund request | Expired |
| `FDR_RENEWED` | institution | Institution renews with a new FDR (`POST /fdrs/:id/renew`) | Renewed |
| `REFUND_REQUESTED` | institution | Institution asks for the deposit back (`POST /fdrs/:id/refund-request`) | Refund requested |
| `REFUND_REJECTED` | officer | Officer rejects the refund request; FDR goes back to `ACTIVE` and reminders resume | Active |
| `FDR_REFUNDED` | officer | Officer approves the refund after the checklist (`POST /fdrs/:id/refund-decision`) | Refunded |

`LEDGER_CREATED` is the genesis entry of the hash chain (`fdrId: null`) and is not shown on the timeline.

## Notifications

`type` ∈ `REMINDER_90`, `REMINDER_60`, `REMINDER_30`, `REMINDER_7`, `ESCALATED`

- Reminders go to the institution 90, 60, 30 and 7 days before `maturityDate`.
- `ESCALATED`: 7 days before maturity, if the institution has not renewed or requested a refund, the FDR is escalated to AICTE.
- No further reminders after the institution renews or requests a refund.
- Institutions see reminders for their own FDRs only. Officers and admins see all notifications, including escalations.

`GET /notifications` modes:

| Query | Returns | Used by |
| --- | --- | --- |
| none (or `asOf`) | Notifications sent on or before `asOf` (default today), newest first | Header bell |
| `asOf` + `upcomingDays` | Notifications due from `asOf` to `asOf + upcomingDays`, plus escalations still open on `asOf`, soonest first | Admin dashboard "Upcoming reminders" (`asOf` = Time Machine date) |
