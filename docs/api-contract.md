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
  "createdAt": "2024-07-03T10:15:00Z",
  "updatedAt": "2026-10-20T09:00:00Z"
}
```

`status` ∈ `SUBMITTED`, `UNDER_SCRUTINY`, `CORRECTION_REQUESTED`, `ACTIVE`, `EXPIRING`, `EXPIRED`, `RENEWED`, `REFUND_REQUESTED`, `REFUNDED`, `REJECTED`

`verification.fields[].result` ∈ `MATCH`, `MISMATCH`, `MISSING`

## Endpoints

| Method | Path | Who | Body / query | Returns |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | all | `{ email, password }` | `{ token, user: { id, name, role } }` |
| GET | `/fdrs` | all (filtered by role) | `?status=&search=&expiringInDays=` | `FDR[]` |
| GET | `/fdrs/:id` | all | — | `FDR` |
| POST | `/fdrs` | institution | multipart: fields + `document` file | `FDR` |
| POST | `/fdrs/:id/verify` | officer | `{ decision: "APPROVE" \| "REJECT" \| "CORRECTION", remarks }` | `FDR` |
| POST | `/fdrs/:id/renew` | institution | multipart: new FDR fields + file | `FDR` |
| POST | `/fdrs/:id/refund-request` | institution | `{ reason }` | `FDR` |
| GET | `/dashboard/stats` | admin | `?asOf=2027-01-01` (Time Machine) | `{ active, expiring30, expired, renewed, refunded, totalAmount, byState: [], byBank: [] }` |
| GET | `/audit-log` | admin | `?fdrId=` | `[{ id, at, actor, action, fdrId, hash, prevHash }]` |
| GET | `/audit-log/verify` | admin | — | `{ valid: true, entries: 412 }` |
| GET | `/notifications` | all | — | `[{ id, at, type, message, fdrId, read }]` |
