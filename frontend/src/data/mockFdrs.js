// Fake data for building screens before the backend is ready.
// Field names follow docs/api-contract.md — keep them identical.

const field = (name, claimed, extracted, bank) => ({
  field: name,
  claimed,
  extracted,
  bank,
  result: extracted == null || bank == null ? 'MISSING' : claimed === extracted && claimed === bank ? 'MATCH' : 'MISMATCH',
});

// overrides: { field: [claimed, extractedByOcr, bankRecord] } for fields that don't simply match
export function verification(f, overrides = {}) {
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
  { id: 'FDR-2026-0006', inst: ['INST-1-4412093', 'Shree Ganesh Institute of Technology', 'Maharashtra'], fdrNumber: 'SBI/FD/0077410', bankName: 'State Bank of India', branch: 'Andheri East', ifsc: 'SBIN0001234', amount: 2500000, issueDate: '2021-12-20', maturityDate: '2026-12-20', status: 'REFUND_REQUESTED',
    refundRequest: { reason: 'AICTE has reduced the security deposit required for our revised intake. This FDR is surplus to the new requirement.', requestedAt: '2026-10-22T11:25:00Z', decision: null, remarks: null } },
  { id: 'FDR-2026-0007', inst: ['INST-1-7801334', 'Malabar College of Engineering', 'Kerala'], fdrNumber: 'IOBA/FD/2290013', bankName: 'Indian Overseas Bank', branch: 'Kozhikode', ifsc: 'IOBA0001198', amount: 10000000, issueDate: '2025-04-01', maturityDate: '2030-04-01', status: 'ACTIVE' },
  { id: 'FDR-2026-0008', inst: ['INST-1-3390217', 'Vidyanagar College of Engineering', 'Karnataka'], fdrNumber: 'CNRB/FD/601877', bankName: 'Canara Bank', branch: 'Jayanagar', ifsc: 'CNRB0000412', amount: 5000000, issueDate: '2026-10-21', maturityDate: '2031-10-21', status: 'CORRECTION_REQUESTED',
    overrides: { maturityDate: ['2031-10-21', '2031-10-21', '2030-10-21'] } },
  { id: 'FDR-2026-0009', inst: ['INST-1-8812450', 'Narmada Polytechnic College', 'Madhya Pradesh'], fdrNumber: 'BKID/FD/3301876', bankName: 'Bank of India', branch: 'Arera Colony', ifsc: 'BKID0008801', amount: 1500000, issueDate: '2022-01-10', maturityDate: '2027-01-10', status: 'ACTIVE' },
  { id: 'FDR-2026-0010', inst: ['INST-1-6120394', 'Kaveri Institute of Engineering', 'Tamil Nadu'], fdrNumber: 'IDIB/FD/7740215', bankName: 'Indian Bank', branch: 'T. Nagar', ifsc: 'IDIB000T014', amount: 6000000, issueDate: '2022-02-25', maturityDate: '2027-02-25', status: 'ACTIVE' },
  { id: 'FDR-2026-0011', inst: ['INST-1-4412093', 'Shree Ganesh Institute of Technology', 'Maharashtra'], fdrNumber: 'SBI/FD/0061288', bankName: 'State Bank of India', branch: 'Andheri East', ifsc: 'SBIN0001234', amount: 5000000, issueDate: '2021-08-10', maturityDate: '2026-08-10', status: 'RENEWED',
    renewedBy: 'FDR-2026-0012' },
  { id: 'FDR-2026-0012', inst: ['INST-1-4412093', 'Shree Ganesh Institute of Technology', 'Maharashtra'], fdrNumber: 'SBI/FD/0119034', bankName: 'State Bank of India', branch: 'Andheri East', ifsc: 'SBIN0001234', amount: 5000000, issueDate: '2026-07-18', maturityDate: '2031-07-18', status: 'ACTIVE',
    renewalOf: 'FDR-2026-0011' },
  { id: 'FDR-2026-0013', inst: ['INST-1-4471902', 'Aravali Institute of Management', 'Rajasthan'], fdrNumber: 'BARB/FD/2207719', bankName: 'Bank of Baroda', branch: 'C-Scheme', ifsc: 'BARB0CSCHEM', amount: 2000000, issueDate: '2021-06-15', maturityDate: '2026-06-15', status: 'REFUNDED',
    refundRequest: { reason: 'Our MBA programme is closed from AY 2026-27 and AICTE approval for it has been withdrawn at our request.', requestedAt: '2026-05-28T10:40:00Z', decision: 'APPROVED', remarks: 'All checks complete. Original FDR received at AICTE on 12 Jun 2026.' } },
];

export const mockFdrs = raw.map(({ inst, overrides, ...f }) => ({
  renewalOf: null, // id of the FDR this one renews
  renewedBy: null, // id of the FDR that replaced this one
  refundRequest: null, // { reason, requestedAt, decision: null | 'APPROVED' | 'REJECTED', remarks }
  ...f,
  institution: { id: inst[0], name: inst[1], state: inst[2] },
  documentUrl: null,
  verification: verification(f, overrides),
}));

const SHARMA = 'Officer R. Sharma';
const NAIR = 'Officer P. Nair';

// Oldest first. Each FDR's lifecycle stages come from these actions.
const events = [
  ['2021-06-01T00:00:00Z', 'System', 'LEDGER_CREATED', null],
  ['2021-06-17T09:30:00Z', 'Aravali Institute of Management', 'FDR_SUBMITTED', 'FDR-2026-0013'],
  ['2021-06-18T10:15:00Z', NAIR, 'SCRUTINY_STARTED', 'FDR-2026-0013'],
  ['2021-06-21T14:50:00Z', NAIR, 'FDR_APPROVED', 'FDR-2026-0013'],
  ['2021-06-21T14:51:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0013'],
  ['2021-08-12T11:00:00Z', 'Shree Ganesh Institute of Technology', 'FDR_SUBMITTED', 'FDR-2026-0011'],
  ['2021-08-13T09:45:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0011'],
  ['2021-08-16T16:05:00Z', SHARMA, 'FDR_APPROVED', 'FDR-2026-0011'],
  ['2021-08-16T16:06:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0011'],
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
  ['2022-01-12T10:05:00Z', 'Narmada Polytechnic College', 'FDR_SUBMITTED', 'FDR-2026-0009'],
  ['2022-01-13T11:20:00Z', NAIR, 'SCRUTINY_STARTED', 'FDR-2026-0009'],
  ['2022-01-17T15:10:00Z', NAIR, 'FDR_APPROVED', 'FDR-2026-0009'],
  ['2022-01-17T15:11:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0009'],
  ['2022-02-28T09:40:00Z', 'Kaveri Institute of Engineering', 'FDR_SUBMITTED', 'FDR-2026-0010'],
  ['2022-03-02T10:30:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0010'],
  ['2022-03-04T12:15:00Z', SHARMA, 'FDR_APPROVED', 'FDR-2026-0010'],
  ['2022-03-04T12:16:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0010'],
  ['2024-07-03T10:15:00Z', 'Shree Ganesh Institute of Technology', 'FDR_SUBMITTED', 'FDR-2026-0001'],
  ['2024-07-04T09:50:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0001'],
  ['2024-07-05T16:20:00Z', SHARMA, 'FDR_APPROVED', 'FDR-2026-0001'],
  ['2024-07-05T16:21:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0001'],
  ['2025-04-03T11:30:00Z', 'Malabar College of Engineering', 'FDR_SUBMITTED', 'FDR-2026-0007'],
  ['2025-04-04T10:05:00Z', NAIR, 'SCRUTINY_STARTED', 'FDR-2026-0007'],
  ['2025-04-07T13:45:00Z', NAIR, 'FDR_APPROVED', 'FDR-2026-0007'],
  ['2025-04-07T13:46:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0007'],
  ['2026-05-16T06:00:00Z', 'System', 'REMINDER_30_SENT', 'FDR-2026-0013'],
  ['2026-05-28T10:40:00Z', 'Aravali Institute of Management', 'REFUND_REQUESTED', 'FDR-2026-0013'],
  ['2026-06-19T12:30:00Z', NAIR, 'FDR_REFUNDED', 'FDR-2026-0013'],
  ['2026-07-11T06:00:00Z', 'System', 'REMINDER_30_SENT', 'FDR-2026-0011'],
  ['2026-07-20T10:10:00Z', 'Shree Ganesh Institute of Technology', 'FDR_RENEWED', 'FDR-2026-0011'],
  ['2026-07-20T10:11:00Z', 'Shree Ganesh Institute of Technology', 'FDR_SUBMITTED', 'FDR-2026-0012'],
  ['2026-07-22T09:20:00Z', SHARMA, 'SCRUTINY_STARTED', 'FDR-2026-0012'],
  ['2026-07-23T15:40:00Z', SHARMA, 'FDR_APPROVED', 'FDR-2026-0012'],
  ['2026-07-23T15:41:00Z', 'System', 'FDR_ACTIVATED', 'FDR-2026-0012'],
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

// Newest first, without hashes: api/client.js seals them into a SHA-256 chain on load.
export const mockAuditLog = events.map(([at, actor, action, fdrId], i) => ({ id: i + 1, at, actor, action, fdrId })).reverse();
