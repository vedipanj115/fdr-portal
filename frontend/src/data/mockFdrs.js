// Fake data for building screens before the backend is ready.
// Field names follow docs/api-contract.md — keep them identical.

const field = (name, claimed, extracted, bank) => ({
  field: name,
  claimed,
  extracted,
  bank,
  result: extracted == null || bank == null ? 'MISSING' : claimed === extracted && claimed === bank ? 'MATCH' : 'MISMATCH',
});

function verification(f, overrides = {}) {
  const base = {
    fdrNumber: [f.fdrNumber, f.fdrNumber, f.fdrNumber],
    bankName: [f.bankName, f.bankName, f.bankName],
    amount: [String(f.amount), String(f.amount), String(f.amount)],
    issueDate: [f.issueDate, f.issueDate, f.issueDate],
    maturityDate: [f.maturityDate, f.maturityDate, f.maturityDate],
    beneficiary: ['AICTE, New Delhi', 'AICTE, New Delhi', 'AICTE, New Delhi'],
    ...overrides,
  };
  const fields = Object.entries(base).map(([k, [c, e, b]]) => field(k, c, e, b));
  return { fields, score: fields.filter((x) => x.result === 'MATCH').length, total: fields.length };
}

const raw = [
  { id: 'FDR-2026-0001', inst: ['INST-1-4412093', 'Shree Ganesh Institute of Technology', 'Maharashtra'], fdrNumber: 'SBI/FD/0098123', bankName: 'State Bank of India', branch: 'Andheri East', ifsc: 'SBIN0001234', amount: 10000000, issueDate: '2024-07-01', maturityDate: '2027-07-01', status: 'ACTIVE' },
  { id: 'FDR-2026-0002', inst: ['INST-1-3390217', 'Vidyanagar College of Engineering', 'Karnataka'], fdrNumber: 'CNRB/FD/551209', bankName: 'Canara Bank', branch: 'Jayanagar', ifsc: 'CNRB0000412', amount: 5000000, issueDate: '2021-11-15', maturityDate: '2026-11-15', status: 'EXPIRING' },
  { id: 'FDR-2026-0003', inst: ['INST-1-5521786', 'Ganga Institute of Pharmacy', 'Uttar Pradesh'], fdrNumber: 'PNB/FD/7733021', bankName: 'Punjab National Bank', branch: 'Hazratganj', ifsc: 'PUNB0123400', amount: 2500000, issueDate: '2026-10-10', maturityDate: '2031-10-10', status: 'UNDER_SCRUTINY',
    overrides: { amount: ['2500000', '2050000', '2500000'] } },
  { id: 'FDR-2026-0004', inst: ['INST-1-2209845', 'Coastal School of Management', 'Gujarat'], fdrNumber: 'BOB/FD/1100982', bankName: 'Bank of Baroda', branch: 'Alkapuri', ifsc: 'BARB0ALKAPU', amount: 3500000, issueDate: '2026-10-18', maturityDate: '2029-10-18', status: 'SUBMITTED',
    overrides: { beneficiary: ['AICTE, New Delhi', null, 'AICTE, New Delhi'] } },
  { id: 'FDR-2026-0005', inst: ['INST-1-6678120', 'Deccan Institute of Architecture', 'Telangana'], fdrNumber: 'UBIN/FD/4455120', bankName: 'Union Bank of India', branch: 'Banjara Hills', ifsc: 'UBIN0560421', amount: 7500000, issueDate: '2021-09-30', maturityDate: '2026-09-30', status: 'EXPIRED' },
  { id: 'FDR-2026-0006', inst: ['INST-1-4412093', 'Shree Ganesh Institute of Technology', 'Maharashtra'], fdrNumber: 'SBI/FD/0077410', bankName: 'State Bank of India', branch: 'Andheri East', ifsc: 'SBIN0001234', amount: 2500000, issueDate: '2021-12-20', maturityDate: '2026-12-20', status: 'REFUND_REQUESTED' },
  { id: 'FDR-2026-0007', inst: ['INST-1-7801334', 'Malabar College of Engineering', 'Kerala'], fdrNumber: 'IOBA/FD/2290013', bankName: 'Indian Overseas Bank', branch: 'Kozhikode', ifsc: 'IOBA0001198', amount: 10000000, issueDate: '2025-04-01', maturityDate: '2030-04-01', status: 'ACTIVE' },
  { id: 'FDR-2026-0008', inst: ['INST-1-3390217', 'Vidyanagar College of Engineering', 'Karnataka'], fdrNumber: 'CNRB/FD/601877', bankName: 'Canara Bank', branch: 'Jayanagar', ifsc: 'CNRB0000412', amount: 5000000, issueDate: '2026-10-21', maturityDate: '2031-10-21', status: 'CORRECTION_REQUESTED',
    overrides: { maturityDate: ['2031-10-21', '2031-10-21', '2030-10-21'] } },
];

export const mockFdrs = raw.map(({ inst, overrides, ...f }) => ({
  ...f,
  institution: { id: inst[0], name: inst[1], state: inst[2] },
  documentUrl: null,
  verification: verification(f, overrides),
}));

// Fake hash so the mock log looks like a chain. The real one is SHA-256 (backend).
function fakeHash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  const hex = h.toString(16).padStart(8, '0');
  return `${hex.slice(0, 4)}…${hex.slice(4)}`;
}

// Next audit entry, linked to the newest one in `log` (newest first).
export function chainEntry(log, { at, actor, action, fdrId = null }) {
  const prev = log[0];
  const prevHash = prev ? prev.hash : '—';
  const hash = prev ? fakeHash(`${prevHash}|${at}|${actor}|${action}|${fdrId}`) : '0000…0000';
  return { id: (prev?.id || 0) + 1, at, actor, action, fdrId, hash, prevHash };
}

const SHARMA = 'Officer R. Sharma';
const NAIR = 'Officer P. Nair';

// Oldest first. Each FDR's lifecycle stages come from these actions.
const events = [
  ['2021-09-01T00:00:00Z', 'System', 'LEDGER_CREATED', null],
  ['2021-10-04T10:20:00Z', 'Deccan Institute of Architecture', 'FDR_SUBMITTED', 'FDR-2026-0005'],
  ['2021-10-06T11:00:00Z', NAIR, 'SCRUTINY_STARTED', 'FDR-2026-0005'],
  ['2021-10-08T15:30:00Z', NAIR, 'FDR_APPROVED', 'FDR-2026-0005'],
  ['2021-10-08T15:31:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0005'],
  ['2021-11-17T09:45:00Z', 'Vidyanagar College of Engineering', 'FDR_SUBMITTED', 'FDR-2026-0002'],
  ['2021-11-19T10:10:00Z', NAIR, 'SCRUTINY_STARTED', 'FDR-2026-0002'],
  ['2021-11-22T12:40:00Z', NAIR, 'FDR_APPROVED', 'FDR-2026-0002'],
  ['2021-11-22T12:41:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0002'],
  ['2021-12-22T09:15:00Z', 'Shree Ganesh Institute of Technology', 'FDR_SUBMITTED', 'FDR-2026-0006'],
  ['2021-12-24T10:30:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0006'],
  ['2021-12-28T14:00:00Z', SHARMA, 'FDR_APPROVED', 'FDR-2026-0006'],
  ['2021-12-28T14:01:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0006'],
  ['2024-07-03T10:15:00Z', 'Shree Ganesh Institute of Technology', 'FDR_SUBMITTED', 'FDR-2026-0001'],
  ['2024-07-04T09:50:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0001'],
  ['2024-07-05T16:20:00Z', SHARMA, 'FDR_APPROVED', 'FDR-2026-0001'],
  ['2024-07-05T16:21:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0001'],
  ['2025-04-03T11:30:00Z', 'Malabar College of Engineering', 'FDR_SUBMITTED', 'FDR-2026-0007'],
  ['2025-04-04T10:05:00Z', NAIR, 'SCRUTINY_STARTED', 'FDR-2026-0007'],
  ['2025-04-07T13:45:00Z', NAIR, 'FDR_APPROVED', 'FDR-2026-0007'],
  ['2025-04-07T13:46:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0007'],
  ['2026-08-31T06:00:00Z', 'System', 'REMINDER_30_SENT', 'FDR-2026-0005'],
  ['2026-09-30T18:30:00Z', 'System', 'FDR_EXPIRED', 'FDR-2026-0005'],
  ['2026-10-10T10:00:00Z', 'Ganga Institute of Pharmacy', 'FDR_SUBMITTED', 'FDR-2026-0003'],
  ['2026-10-12T09:40:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0003'],
  ['2026-10-16T06:00:00Z', 'System', 'REMINDER_30_SENT', 'FDR-2026-0002'],
  ['2026-10-18T14:12:00Z', 'Coastal School of Management', 'FDR_SUBMITTED', 'FDR-2026-0004'],
  ['2026-10-21T09:30:00Z', 'Vidyanagar College of Engineering', 'FDR_SUBMITTED', 'FDR-2026-0008'],
  ['2026-10-22T11:25:00Z', 'Shree Ganesh Institute of Technology', 'REFUND_REQUESTED', 'FDR-2026-0006'],
  ['2026-10-23T10:00:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0008'],
  ['2026-10-24T16:42:00Z', SHARMA, 'CORRECTION_REQUESTED', 'FDR-2026-0008'],
];

export const mockAuditLog = events.reduce(
  (log, [at, actor, action, fdrId]) => [chainEntry(log, { at, actor, action, fdrId }), ...log],
  []
);
