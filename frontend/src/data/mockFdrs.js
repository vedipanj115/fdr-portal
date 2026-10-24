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

export const mockAuditLog = [
  { id: 6, at: '2026-10-24T16:42:00Z', actor: 'Officer R. Sharma', action: 'CORRECTION_REQUESTED', fdrId: 'FDR-2026-0008', hash: '9f3a…c21e', prevHash: '41bd…0a77' },
  { id: 5, at: '2026-10-24T11:05:00Z', actor: 'System', action: 'REMINDER_30_SENT', fdrId: 'FDR-2026-0002', hash: '41bd…0a77', prevHash: 'c0e9…5b12' },
  { id: 4, at: '2026-10-21T09:30:00Z', actor: 'Vidyanagar College of Engineering', action: 'FDR_SUBMITTED', fdrId: 'FDR-2026-0008', hash: 'c0e9…5b12', prevHash: '77a2…e9d0' },
  { id: 3, at: '2026-10-18T14:12:00Z', actor: 'Coastal School of Management', action: 'FDR_SUBMITTED', fdrId: 'FDR-2026-0004', hash: '77a2…e9d0', prevHash: '1c4f…aa31' },
  { id: 2, at: '2026-10-10T10:00:00Z', actor: 'Ganga Institute of Pharmacy', action: 'FDR_SUBMITTED', fdrId: 'FDR-2026-0003', hash: '1c4f…aa31', prevHash: '0000…0000' },
  { id: 1, at: '2026-10-01T00:00:00Z', actor: 'System', action: 'LEDGER_CREATED', fdrId: null, hash: '0000…0000', prevHash: '—' },
];
