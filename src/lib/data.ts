import type { AppState, Deposit, Institution, Region, User, AuditEntry, Doc, VaultMove } from './types';
import { addDays, addYears, diffDays, rng, sha256 } from './util';

export const BANKS: Record<string, { name: string; scheduled: boolean; slow: number }> = {
  SBIN: { name: 'State Bank of India', scheduled: true, slow: 1.0 },
  PUNB: { name: 'Punjab National Bank', scheduled: true, slow: 1.5 },
  BARB: { name: 'Bank of Baroda', scheduled: true, slow: 1.2 },
  CNRB: { name: 'Canara Bank', scheduled: true, slow: 1.3 },
  UBIN: { name: 'Union Bank of India', scheduled: true, slow: 2.2 },
  BKID: { name: 'Bank of India', scheduled: true, slow: 1.4 },
  IOBA: { name: 'Indian Overseas Bank', scheduled: true, slow: 1.6 },
  CBIN: { name: 'Central Bank of India', scheduled: true, slow: 1.9 },
  MAHB: { name: 'Bank of Maharashtra', scheduled: true, slow: 1.1 },
  HDFC: { name: 'HDFC Bank', scheduled: true, slow: 0.6 },
  ICIC: { name: 'ICICI Bank', scheduled: true, slow: 0.7 },
  UTIB: { name: 'Axis Bank', scheduled: true, slow: 0.8 },
  SLCC: { name: 'Shree Laxmi Urban Co-op Credit Society (fictional)', scheduled: false, slow: 3 },
};
export const bankName = (code: string) => BANKS[code]?.name || 'Unknown bank';

export const REGIONS: { name: Region; office: string; code: string; states: [string, string[]][] }[] = [
  { name: 'Northern', office: 'New Delhi', code: 'NRO', states: [['Delhi', ['New Delhi']], ['Uttar Pradesh', ['Lucknow', 'Kanpur', 'Noida', 'Varanasi']], ['Uttarakhand', ['Dehradun']]] },
  { name: 'North-West', office: 'Chandigarh', code: 'NWRO', states: [['Punjab', ['Ludhiana', 'Patiala']], ['Haryana', ['Rohtak', 'Karnal', 'Gurugram']], ['Rajasthan', ['Jaipur', 'Udaipur']], ['Himachal Pradesh', ['Shimla']]] },
  { name: 'Western', office: 'Mumbai', code: 'WRO', states: [['Maharashtra', ['Pune', 'Nagpur', 'Nashik', 'Mumbai']], ['Gujarat', ['Ahmedabad', 'Surat', 'Vadodara']], ['Goa', ['Panaji']]] },
  { name: 'Central', office: 'Bhopal', code: 'CRO', states: [['Madhya Pradesh', ['Bhopal', 'Indore', 'Jabalpur']], ['Chhattisgarh', ['Raipur', 'Bhilai']]] },
  { name: 'Eastern', office: 'Kolkata', code: 'ERO', states: [['West Bengal', ['Kolkata', 'Durgapur']], ['Odisha', ['Bhubaneswar', 'Cuttack']], ['Jharkhand', ['Ranchi']], ['Assam', ['Guwahati']]] },
  { name: 'South-Central', office: 'Hyderabad', code: 'SCRO', states: [['Telangana', ['Hyderabad', 'Warangal']], ['Andhra Pradesh', ['Vijayawada', 'Guntur', 'Visakhapatnam']]] },
  { name: 'Southern', office: 'Chennai', code: 'SRO', states: [['Tamil Nadu', ['Chennai', 'Coimbatore', 'Salem', 'Madurai']], ['Puducherry', ['Puducherry']]] },
  { name: 'South-West', office: 'Bengaluru', code: 'SWRO', states: [['Karnataka', ['Bengaluru', 'Mysuru', 'Belagavi']], ['Kerala', ['Thrissur', 'Kochi']]] },
];
export const regionOf = (r: Region) => REGIONS.find(x => x.name === r)!;

const PREFIX = ['Aranya', 'Vidyadeep', 'Neelgiri', 'Suryoday', 'Kaveri Valley', 'Trivikram', 'Sahasra', 'Amrutvahini', 'Dhruvtara', 'Pragati Nagar', 'Shravasti', 'Navdeep',
  'Indrayani', 'Gyanoday', 'Rudraksh', 'Saptagiri', 'Vindhya', 'Tejasvi', 'Akshar', 'Mahananda', 'Shubham', 'Chandrabhaga', 'Kalinga', 'Abhyudaya', 'Swarnim', 'Arunodaya',
  'Dakshin', 'Purvanchal', 'Satpura', 'Yashwant', 'Godavari', 'Narmada', 'Sindhu', 'Ekalavya', 'Prerna', 'Vasundhara', 'Himgiri', 'Malaygiri', 'Sahyagiri', 'Tapti',
  'Krishna Valley', 'Mandakini', 'Shivalik', 'Aravali', 'Brahmaputra', 'Kshitij', 'Nalanda Nagar', 'Udayagiri', 'Pushpagiri', 'Meghdoot', 'Sarita', 'Anant', 'Shreyas',
  'Vardhaman', 'Ankur', 'Saraswati Vihar', 'Kalpataru', 'Deepjyoti', 'Pratibha', 'Navjeevan'];
const TYPES: [string, number][] = [['Institute of Technology', 100], ['College of Engineering', 100], ['Institute of Engineering & Research', 100], ['Institute of Management', 50],
  ['College of Pharmacy', 50], ['Polytechnic', 25], ['School of Architecture', 50], ['College of Computer Applications', 50]];

const pad = (n: number, w: number) => String(n).padStart(w, '0');

export function seed(base: string): AppState {
  const R = rng(20261026);
  const by = +base.slice(0, 4);
  const institutions: Institution[] = [];
  const used = new Set<string>();
  const regionWeights = [22, 24, 34, 18, 16, 26, 28, 22];
  let n = 0;
  REGIONS.forEach((reg, ri) => {
    for (let k = 0; k < regionWeights[ri]; k++) {
      let name = '';
      for (let tries = 0; tries < 20; tries++) {
        const t = R.pick(TYPES); name = `${R.pick(PREFIX)} ${t[0]}`; if (!used.has(name)) { used.add(name); break; }
      }
      const t = TYPES.find(x => name.endsWith(x[0]))!;
      const [state, cities] = R.pick(reg.states);
      n++;
      const est = R.chance(0.6) ? R.pick([2008, 2009, 2010, 2011, 2011, 2012, 2012, 2013, 2013, 2014, 2014, 2015, 2015, 2015, 2016, 2016, 2016, 2016, 2016, 2017, 2017, 2017, 2017, 2017, 2018, 2018]) : R.int(2019, by - 1);
      const leased = R.chance(0.12);
      const st = R.chance(0.07) ? 'Closed' : R.chance(0.015) ? 'Merged' : 'Active';
      institutions.push({
        id: 'INST' + pad(n, 3), aicteId: `1-${R.int(40000000, 49999999)}${R.int(10, 99)}`, name, type: t[0], city: R.pick(cities), state, region: reg.name,
        established: est, status: st, intake: R.pick([120, 180, 240, 300, 360, 420, 600]), leased, requiredLakh: t[1] * (leased ? 2 : 1),
        openComplaints: R.chance(0.06) ? R.int(1, 3) : 0, email: `registrar.inst${pad(n, 3)}@example.edu.in`, phone: `98${R.int(10000000, 99999999)}`,
      });
    }
  });

  const deposits: Deposit[] = [];
  const vault: VaultMove[] = [];
  let dn = 0;
  const lockerCount: Record<string, number> = {};
  const codes = Object.keys(BANKS).filter(c => c !== 'SLCC');
  const officerOf: Record<string, string> = { Northern: 'S. Bhatia', 'North-West': 'H. Gill', Western: 'R. Kulkarni', Central: 'P. Tiwari', Eastern: 'A. Sen', 'South-Central': 'K. Reddy', Southern: 'M. Iyer', 'South-West': 'V. Nair' };
  const doc = (kind: Doc['kind'], name: string, on: string, byWho: string, seedStr: string): Doc => ({ id: 'DOC' + sha256(seedStr).slice(0, 8).toUpperCase(), name, kind, uploadedOn: on, by: byWho, sha256: sha256(seedStr), sizeKb: R.int(180, 900), generated: true });

  const mkFDR = (inst: Institution, issue: string, amount: number, opts: Partial<Deposit> = {}, bankCode?: string): Deposit => {
    dn++;
    const code = bankCode || R.pick(codes);
    const ifsc = `${code}0${pad(R.int(1000, 999999), 6)}`;
    const number = `${code.slice(0, 2)}${R.int(10000000, 99999999)}`;
    const maturity = addYears(issue, 10);
    const submittedOn = addDays(issue, R.int(1, 6));
    const reqOn = addDays(submittedOn, 1);
    const tat = Math.max(1, Math.round(R.int(2, 9) * BANKS[code].slow));
    const hash = sha256(`FDR|${number}|${amount}|${issue}|${maturity}`);
    const reg = regionOf(inst.region);
    lockerCount[reg.code] = (lockerCount[reg.code] || 0) + 1;
    const locker = `${reg.code}-L${pad(Math.ceil(lockerCount[reg.code] / 6), 2)}`;
    const d: Deposit = {
      id: `SD-${issue.slice(0, 4)}-${pad(dn, 5)}`, instId: inst.id, kind: 'FDR', number, bankCode: code, bankName: BANKS[code].name, ifsc,
      branch: `${inst.city} Main`, claimed: { amountLakh: amount, issue, maturity },
      confirmed: { amountLakh: amount, maturity, lien: true, on: addDays(reqOn, tat), by: `${BANKS[code].name}, ${inst.city} Main`, via: 'Bank confirmation desk' },
      verification: 'Verified', requestedOn: reqOn, submittedOn, affidavit: true,
      docs: [doc('FDR', `FDR_${number}.pdf`, submittedOn, inst.name, hash), doc('Affidavit', 'Affidavit_Format2.pdf', submittedOn, inst.name, 'AFF' + number)],
      notes: [], hashStored: hash, hashCurrent: hash,
      custody: { state: 'In locker', locker, since: addDays(submittedOn, R.int(5, 20)) },
      ...opts,
    };
    vault.push({ at: d.custody!.since, depId: d.id, locker, action: 'Received from institution', by: officerOf[inst.region], reason: 'Original FDR received by post' });
    deposits.push(d);
    return d;
  };
  const mkOnline = (inst: Institution, paid: string, amount: number, received = amount): Deposit => {
    dn++;
    const ref = `AICTE-SD-${paid.slice(0, 4)}-${pad(R.int(100, 99999), 5)}`;
    const hash = sha256(`ONL|${ref}|${amount}|${paid}`);
    const d: Deposit = {
      id: `SD-${paid.slice(0, 4)}-${pad(dn, 5)}`, instId: inst.id, kind: 'Online', number: ref, bankCode: 'AICTE', bankName: 'AICTE account (payment gateway)', ifsc: '',
      branch: 'Online payment', claimed: { amountLakh: amount, issue: paid, maturity: addYears(paid, 10) },
      confirmed: { amountLakh: received, maturity: addYears(paid, 10), lien: true, on: addDays(paid, 1), by: 'Payment gateway reconciliation', via: 'Gateway settlement file' },
      verification: received === amount ? 'Verified' : 'Mismatch', requestedOn: paid, submittedOn: paid, affidavit: true,
      docs: [doc('Payment receipt', `Receipt_${ref}.pdf`, paid, 'Payment gateway', hash), doc('Affidavit', 'Affidavit_Format2.pdf', paid, inst.name, 'AFF' + ref)],
      notes: [], hashStored: hash, hashCurrent: hash,
    };
    deposits.push(d); return d;
  };

  const randDateIn = (y: number) => `${y}-${pad(R.int(1, 12), 2)}-${pad(R.int(1, 28), 2)}`;
  institutions.forEach(inst => {
    const req = inst.requiredLakh;
    if (inst.established <= 2018 || R.chance(0.25)) {
      let issue = randDateIn(inst.established);
      if (diffDays(issue, base) > -30) issue = addDays(base, -R.int(40, 200));
      const d = mkFDR(inst, issue, req);
      if (diffDays(d.claimed.maturity, base) < 0) {
        // matured: renewed, released or left unactioned
        const roll = R.next();
        if (inst.status !== 'Active' || roll < 0.18) {
          d.release = { reason: inst.status === 'Active' ? '10-year term completed' : 'Institution closed', requestedOn: addDays(d.claimed.maturity, R.int(5, 60)), status: 'Lien released', letter: true };
          d.release.approvedOn = addDays(d.release.requestedOn, R.int(10, 40)); d.release.approvedBy = 'Regulation Bureau, AICTE';
          d.release.lienReleasedOn = addDays(d.release.approvedOn, R.int(3, 15));
          if (diffDays(d.release.lienReleasedOn, base) > 0) d.release.lienReleasedOn = addDays(base, -2);
          d.custody = { state: 'Checked out', locker: d.custody!.locker, since: d.release.approvedOn, reason: 'Handed to bank after NOC' };
        } else if (roll < 0.86 || diffDays(base, d.claimed.maturity) > 420) {
          const nd = mkFDR(inst, addDays(d.claimed.maturity, -R.int(0, 25)), req, {}, d.bankCode);
          nd.replaces = d.id; d.replacedBy = nd.id;
          d.custody = { state: 'Checked out', locker: d.custody!.locker, since: nd.submittedOn, reason: 'Returned to bank for renewal' };
        }
      }
    } else {
      const paid = randDateIn(inst.established);
      mkOnline(inst, diffDays(paid, base) > -10 ? addDays(base, -R.int(20, 120)) : paid, req);
    }
  });

  // ---- planted, realistic problems ----
  const live = () => deposits.filter(d => !d.replacedBy && !d.release && d.kind === 'FDR');
  const pickLive = (f: (d: Deposit) => boolean = () => true) => { const xs = live().filter(d => !d.notes.length && d.verification === 'Verified' && f(d)); return xs[R.int(0, xs.length - 1)]; };
  const note = (d: Deposit, text: string) => d.notes.push({ id: 'N' + d.id, on: d.submittedOn, by: 'System', role: 'officer', kind: 'Observation', text });
  // maturity mismatch: institution claims 10 years, bank says 6
  for (let i = 0; i < 3; i++) { const d = pickLive(x => diffDays(x.claimed.maturity, base) > 400); if (!d) continue; d.confirmed!.maturity = addYears(d.claimed.issue, 6); d.verification = 'Mismatch'; note(d, 'Bank-confirmed maturity differs from the submitted FDR.'); }
  // amount mismatch
  for (let i = 0; i < 2; i++) { const d = pickLive(); if (!d) continue; d.confirmed!.amountLakh = d.claimed.amountLakh / 2; d.verification = 'Mismatch'; note(d, 'Bank-confirmed amount is lower than claimed.'); }
  // lien not marked
  { const d = pickLive(); if (d) { d.confirmed!.lien = false; d.verification = 'Mismatch'; note(d, 'Bank reports no lien in favour of AICTE.'); } }
  // duplicate FDR number across two institutions
  { const a = pickLive(), b = pickLive(x => x.instId !== a?.instId); if (a && b) { b.number = a.number; b.bankCode = a.bankCode; b.bankName = a.bankName; } }
  // non-scheduled co-op bank
  for (let i = 0; i < 2; i++) { const d = pickLive(); if (!d) continue; d.bankCode = 'SLCC'; d.bankName = BANKS.SLCC.name; d.ifsc = 'SLCC0' + d.ifsc.slice(5); d.confirmed = undefined; d.verification = 'Not found'; d.number = 'SL' + d.number.slice(2); }
  // tampered stored document
  { const d = pickLive(); if (d) d.hashCurrent = sha256('tampered' + d.number); }
  // missing affidavit
  for (let i = 0; i < 4; i++) { const d = pickLive(); if (!d) continue; d.affidavit = false; d.docs = d.docs.filter(x => x.kind !== 'Affidavit'); }
  // shortfall: deposit below required amount (leased building rule)
  institutions.filter(i => i.leased).slice(0, 4).forEach(i => { const d = deposits.find(x => x.instId === i.id && !x.replacedBy && !x.release); if (d && d.kind === 'FDR' && d.verification === 'Verified') { d.claimed.amountLakh = i.requiredLakh / 2; d.confirmed!.amountLakh = i.requiredLakh / 2; } });
  // online short payment
  { const d = deposits.find(x => x.kind === 'Online' && x.verification === 'Verified'); if (d) { d.confirmed!.amountLakh = d.claimed.amountLakh * 0.6; d.verification = 'Mismatch'; } }
  // recent submissions waiting for banks (some beyond the SLA)
  const recentInst = institutions.filter(i => i.status === 'Active' && i.established >= 2019 && !deposits.some(d => d.instId === i.id && d.kind === 'FDR')).slice(0, 14);
  recentInst.forEach((inst, k) => {
    const age = [2, 3, 4, 6, 8, 9, 11, 13, 16, 19, 22, 26, 31, 40][k];
    const d = mkFDR(inst, addDays(base, -age - 3), inst.requiredLakh);
    d.submittedOn = addDays(base, -age); d.requestedOn = addDays(base, -age);
    d.confirmed = undefined; d.verification = k % 5 === 4 ? 'Awaiting checker' : 'Awaiting bank';
    if (d.verification === 'Awaiting checker') d.maker = { amountLakh: d.claimed.amountLakh, maturity: d.claimed.maturity, lien: true, on: addDays(base, -1), by: 'Branch officer', via: 'Core banking fetch' };
    d.custody = { state: 'In transit to RO', locker: d.custody!.locker, since: d.submittedOn };
    // the online deposit (if any) for this institution is replaced by this FDR in the data story; remove duplicates
    const onl = deposits.findIndex(x => x.instId === inst.id && x.kind === 'Online'); if (onl >= 0) deposits.splice(onl, 1);
  });
  // open release requests
  const relCands = deposits.filter(d => !d.replacedBy && !d.release && d.verification === 'Verified' && d.kind === 'FDR' && (diffDays(d.claimed.maturity, base) < 0 || institutions.find(i => i.id === d.instId)!.status !== 'Active'));
  relCands.slice(0, 6).forEach((d, k) => {
    const inst = institutions.find(i => i.id === d.instId)!;
    d.release = { reason: inst.status === 'Active' ? '10-year term completed' : 'Institution closed', requestedOn: addDays(base, -R.int(3, 25)), status: 'Requested', letter: k !== 2 };
    if (k === 1) inst.openComplaints = 2;
    if (k === 5) { d.release.status = 'Approved'; d.release.approvedOn = addDays(base, -4); d.release.approvedBy = 'Regulation Bureau, AICTE'; d.release.nocHash = sha256('NOC' + d.id); }
  });
  // originals currently out of the locker
  live().filter(d => d.custody?.state === 'In locker').slice(0, 2).forEach(d => { d.custody = { state: 'Checked out', locker: d.custody!.locker, since: addDays(base, -R.int(9, 30)), reason: 'Bank verification visit' }; vault.push({ at: d.custody.since, depId: d.id, locker: d.custody.locker, action: 'Checked out', by: 'Vault custodian', reason: 'Bank verification visit' }); });

  const users: User[] = [
    { id: 'U1', role: 'officer', loginId: 'AICTE-RB-1024', password: 'Demo@123', name: 'R. Kulkarni', designation: 'Deputy Director, Regulation Bureau', email: 'rb.officer@example.gov.in', mobile: '9810000001', region: 'HQ' },
    { id: 'U2', role: 'institution', loginId: '', password: 'Demo@123', name: 'Registrar', designation: 'Registrar', email: '', mobile: '9810000002', instId: '' },
    { id: 'U3', role: 'bank', loginId: 'SBIN-MKR-01', password: 'Demo@123', name: 'A. Deshpande', designation: 'Branch officer (maker)', email: 'maker@example-bank.in', mobile: '9810000003', bankCode: 'SBIN', bankRole: 'maker' },
    { id: 'U4', role: 'bank', loginId: 'SBIN-CHK-01', password: 'Demo@123', name: 'S. Menon', designation: 'Branch manager (checker)', email: 'checker@example-bank.in', mobile: '9810000004', bankCode: 'SBIN', bankRole: 'checker' },
  ];
  // demo institution: an active college with a live FDR at SBI
  const okDep = (i: Institution, lo: number, hi: number) => deposits.some(d => d.instId === i.id && !d.replacedBy && !d.release && d.verification === 'Verified' && d.kind === 'FDR' && diffDays(d.claimed.maturity, base) >= lo && diffDays(d.claimed.maturity, base) <= hi);
  const demoInst = institutions.find(i => i.status === 'Active' && okDep(i, 25, 89) && !deposits.some(d => d.instId === i.id && d.verification !== 'Verified')) || institutions.find(i => i.status === 'Active' && okDep(i, 0, 4000)) || institutions[0];
  users[1].loginId = demoInst.aicteId; users[1].instId = demoInst.id; users[1].email = demoInst.email; users[1].name = 'Registrar, ' + demoInst.name;
  // give the demo bank a few items waiting
  deposits.filter(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker').slice(0, 5).forEach(d => { d.bankCode = 'SBIN'; d.bankName = BANKS.SBIN.name; d.ifsc = 'SBIN0' + d.ifsc.slice(5); d.number = 'SB' + d.number.slice(2); });

  const st: AppState = {
    version: 3, baseDate: base, offset: 0, institutions, deposits, users, audit: [], notices: [], vault,
    config: { reminders: [90, 30, 7], escalateAfter: 15, bankSla: 7, bankEscalate: 14, seasonLead: 120 }, esign: [], scrutinyClosed: [],
  };
  // audit history from the seeded events (last 120 days)
  const ev: { at: string; actor: string; role: AuditEntry['role']; action: string; ref: string }[] = [];
  deposits.forEach(d => {
    if (diffDays(d.submittedOn, base) > -120) ev.push({ at: d.submittedOn + `T${String(9 + (d.number.charCodeAt(5) % 8)).padStart(2, '0')}:${String(d.number.charCodeAt(7) % 60).padStart(2, '0')}:00`, actor: 'Registrar, ' + institutions.find(i => i.id === d.instId)!.name, role: 'institution', action: `Submitted ${d.kind === 'FDR' ? 'FDR' : 'online deposit'} ${d.number}`, ref: d.id });
    if (d.confirmed && diffDays(d.confirmed.on, base) > -120 && diffDays(d.confirmed.on, base) <= 0) ev.push({ at: d.confirmed.on + `T${String(11 + (d.number.charCodeAt(6) % 6)).padStart(2, '0')}:${String(d.number.charCodeAt(4) % 60).padStart(2, '0')}:00`, actor: d.confirmed.by, role: 'bank', action: `Confirmed ${d.number}: ${d.verification === 'Verified' ? 'values match' : 'values differ'}`, ref: d.id });
    if (d.release?.lienReleasedOn && diffDays(d.release.lienReleasedOn, base) > -120) ev.push({ at: d.release.lienReleasedOn + 'T12:05:00', actor: d.bankName, role: 'bank', action: `Released lien on ${d.number}`, ref: d.id });
  });
  ev.sort((a, b) => a.at.localeCompare(b.at));
  let prev = '0'.repeat(64);
  st.audit = ev.map((e, i) => { const hash = sha256(`${prev}|${e.at}|${e.actor}|${e.action}|${e.ref}`); const a = { seq: i + 1, ...e, prev, hash }; prev = hash; return a; });
  return st;
}
