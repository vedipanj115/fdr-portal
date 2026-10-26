import type { AppState, Deposit, Institution, PublicSummary } from './types';
import { BANKS } from './data';
import { addDays, diffDays, fmtDate } from './util';

export const today = (s: AppState) => addDays(s.baseDate, s.offset);

export type Life = 'Active' | 'Expiring' | 'Matured' | 'Renewed' | 'Released' | 'Pending';
export const LIFE: Life[] = ['Active', 'Expiring', 'Pending', 'Matured', 'Renewed', 'Released'];
// fixed categorical slots (validated order), one colour per status
export const LIFE_COLOR: Record<Life, string> = { Active: 'var(--c1)', Expiring: 'var(--c2)', Pending: 'var(--c3)', Matured: 'var(--c8)', Renewed: 'var(--c7)', Released: 'var(--c6)' };
export const LIFE_HELP: Record<Life, string> = {
  Active: 'Verified by the bank and valid', Expiring: 'Matures within the reminder window', Pending: 'Waiting for bank verification or has a discrepancy',
  Matured: 'Maturity date passed, not renewed or released', Renewed: 'Replaced by a renewed instrument', Released: 'Released or refunded after NOC',
};

export function life(d: Deposit, s: AppState, t = today(s)): Life {
  if (d.release && (d.release.status === 'Lien released')) return 'Released';
  if (d.replacedBy) return 'Renewed';
  if (d.verification !== 'Verified') return 'Pending';
  const left = diffDays(d.claimed.maturity, t);
  if (left < 0) return 'Matured';
  if (left <= Math.max(...s.config.reminders)) return 'Expiring';
  return 'Active';
}
export const isOpen = (d: Deposit) => !d.replacedBy && !(d.release && d.release.status === 'Lien released');
export const effMaturity = (d: Deposit) => d.confirmed?.maturity || d.claimed.maturity;

export type Sev = 'critical' | 'action' | 'info';
export interface Flag { code: string; sev: Sev; title: string; detail: string; rule: string; depId: string; instId: string; }

export function flagsOf(d: Deposit, s: AppState, t = today(s), all = s.deposits): Flag[] {
  if (!isOpen(d)) return [];
  const inst = s.institutions.find(i => i.id === d.instId)!;
  const f: Flag[] = [];
  const add = (code: string, sev: Sev, title: string, detail: string, rule: string) => f.push({ code, sev, title, detail, rule, depId: d.id, instId: d.instId });
  const c = d.confirmed;
  if (c && d.verification === 'Mismatch') {
    if (c.amountLakh !== d.claimed.amountLakh) add('amount', 'critical', 'Amount mismatch', `Submitted ₹${d.claimed.amountLakh} L, bank confirms ₹${+c.amountLakh.toFixed(2)} L`, 'Submitted vs bank-confirmed (PS item 3)');
    if (c.maturity !== d.claimed.maturity) add('maturity', 'critical', 'Maturity date mismatch', `Submitted ${fmtDate(d.claimed.maturity)}, bank confirms ${fmtDate(c.maturity)}`, 'Submitted vs bank-confirmed (PS item 3)');
    if (!c.lien) add('lien', 'critical', 'No lien in favour of AICTE', 'Bank reports the FDR is not lien-marked to AICTE', 'FDR must be pledged to Member Secretary, AICTE');
  }
  if (d.verification === 'Not found') add('notfound', 'critical', 'Bank could not confirm', 'The issuing bank has no record of this instrument', 'Verification through authorised source');
  if (d.kind === 'FDR' && BANKS[d.bankCode] && !BANKS[d.bankCode].scheduled) add('bank', 'critical', 'Bank not eligible', `${d.bankName} is not an RBI-scheduled bank`, 'FDR must be from a nationalised or scheduled bank');
  if (d.kind === 'FDR' && all.some(x => x !== d && x.number === d.number && x.bankCode === d.bankCode && isOpen(x))) add('dup', 'critical', 'Duplicate FDR number', `${d.number} is also submitted by another institution`, 'One instrument, one institution');
  if (d.hashCurrent !== d.hashStored) add('tamper', 'critical', 'Stored document altered', 'SHA-256 fingerprint no longer matches the one recorded at submission', 'Document integrity');
  if (!d.affidavit) add('affidavit', 'action', 'Affidavit missing', 'Prescribed affidavit not uploaded', 'Missing documents');
  if (d.kind === 'FDR' && Math.abs(diffDays(d.claimed.maturity, d.claimed.issue) - 3652) > 3) add('term', 'action', 'Term is not 10 years', 'Deposit must be kept for 10 years', 'Approval Process Handbook');
  const pending = d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker';
  if (pending && d.requestedOn) {
    const age = diffDays(t, d.requestedOn);
    if (age > s.config.bankEscalate) add('bankslow', 'critical', `Bank silent for ${age} days`, `Escalated to the bank's nodal officer (SLA ${s.config.bankSla} days)`, 'Escalation (PS item 7)');
    else if (age > s.config.bankSla) add('bankslow', 'action', `Bank reply overdue (${age} days)`, `Reminder sent to ${d.bankName}`, 'Pending verification alert (PS item 7)');
  }
  const left = diffDays(effMaturity(d), t);
  const relOpen = d.release && d.release.status !== 'Rejected';
  if (!relOpen && d.verification === 'Verified') {
    if (left < -s.config.escalateAfter) add('overdue', 'critical', `Matured ${-left} days ago`, 'No renewal or release request. Escalated to the Regional Director', 'Escalation (PS item 7)');
    else if (left < 0) add('overdue', 'action', `Matured ${-left} days ago`, 'Institution reminded to renew or apply for release', 'Maturity tracking (PS item 4)');
    else if (left <= Math.max(...s.config.reminders)) add('expiring', left <= 30 ? 'action' : 'info', `Matures in ${left} days`, `Reminder schedule: ${s.config.reminders.join(' / ')} days before`, 'Advance reminder (PS item 4)');
    const m = +effMaturity(d).slice(5, 7);
    if (left > 0 && left <= 365 && m >= 1 && m <= 4 && left > 90) add('season', 'info', 'Matures in approval season', 'Jan–Apr maturities are flagged early so refunds are not held up', 'Approval-Season Guard');
  }
  if (inst.status !== 'Active' && !relOpen && d.verification === 'Verified') add('orphan', 'action', 'Orphan deposit', `Institution is ${inst.status.toLowerCase()} but no release request is filed`, 'Orphan FDR Finder');
  return f;
}

export function instFlags(inst: Institution, s: AppState): Flag[] {
  const held = s.deposits.filter(d => d.instId === inst.id && isOpen(d) && d.verification === 'Verified' && !(d.release && d.release.status !== 'Rejected')).reduce((a, d) => a + (d.confirmed?.amountLakh ?? d.claimed.amountLakh), 0);
  const any = s.deposits.some(d => d.instId === inst.id && isOpen(d));
  if (inst.status === 'Active' && any && held > 0 && held < inst.requiredLakh) return [{ code: 'topup', sev: 'action', title: 'Deposit shortfall', detail: `Holds ₹${+held.toFixed(2)} L of ₹${inst.requiredLakh} L required`, rule: 'Deposit Top-Up Detector', depId: '', instId: inst.id }];
  return [];
}

export function allFlags(s: AppState) {
  const t = today(s);
  const f = s.deposits.flatMap(d => flagsOf(d, s, t));
  s.institutions.forEach(i => f.push(...instFlags(i, s)));
  const rank = { critical: 0, action: 1, info: 2 } as const;
  return f.sort((a, b) => rank[a.sev] - rank[b.sev]);
}

export interface Check { ok: boolean; label: string; detail: string; }
export function releaseChecks(d: Deposit, s: AppState): Check[] {
  const inst = s.institutions.find(i => i.id === d.instId)!;
  const t = today(s);
  const termDone = diffDays(effMaturity(d), t) <= 0;
  return [
    { ok: termDone || inst.status !== 'Active', label: 'Eligible reason', detail: termDone ? '10-year term completed' : inst.status !== 'Active' ? `Institution ${inst.status.toLowerCase()} (closure approved)` : `Term ends ${fmtDate(effMaturity(d))}` },
    { ok: d.verification === 'Verified', label: 'Bank-verified instrument', detail: d.verification === 'Verified' ? `Confirmed by ${d.confirmed?.by}` : `Verification: ${d.verification}` },
    { ok: inst.openComplaints === 0, label: 'No open complaints', detail: inst.openComplaints ? `${inst.openComplaints} student complaint(s) pending` : 'None on record' },
    { ok: !!d.release?.letter, label: 'Request letter on letterhead', detail: d.release?.letter ? 'Uploaded' : 'Not uploaded' },
    { ok: d.affidavit, label: 'Affidavit on record', detail: d.affidavit ? 'Uploaded' : 'Missing' },
    { ok: d.kind === 'Online' || d.custody?.state === 'In locker', label: 'Original FDR in AICTE custody', detail: d.kind === 'Online' ? 'Online deposit (no paper original)' : d.custody ? `${d.custody.state}, ${d.custody.locker}` : 'Not received' },
  ];
}

export interface Alert { id: string; at: string; to: string; channel: string; sev: Sev; title: string; detail: string; depId: string; instId: string; stage: string; }
// What the scheduler sends on a given day (derived from flags and the configured reminder days)
export function alertsFor(s: AppState): Alert[] {
  const t = today(s); const out: Alert[] = [];
  s.deposits.forEach(d => {
    if (!isOpen(d)) return;
    const inst = s.institutions.find(i => i.id === d.instId)!;
    const left = diffDays(effMaturity(d), t);
    const rel = d.release && d.release.status !== 'Rejected';
    if (d.verification === 'Verified' && !rel) {
      s.config.reminders.forEach(r => {
        if (left <= r && left > (s.config.reminders.filter(x => x < r).sort((a, b) => b - a)[0] ?? -1)) out.push({ id: `${d.id}-r${r}`, at: addDays(effMaturity(d), -r), to: r <= 30 ? 'Institution + Regional Office' : 'Institution', channel: 'Email + SMS', sev: r <= 7 ? 'action' : 'info', title: `${r}-day maturity reminder`, detail: `${d.number} of ${inst.name} matures on ${fmtDate(effMaturity(d))}`, depId: d.id, instId: inst.id, stage: 'Reminder' });
      });
      if (left < 0) out.push({ id: `${d.id}-od`, at: effMaturity(d), to: 'Institution + Regional Office', channel: 'Email + SMS', sev: 'action', title: 'Matured, action needed', detail: `${d.number} of ${inst.name} matured. Renew or apply for release`, depId: d.id, instId: inst.id, stage: 'Overdue' });
      if (left < -s.config.escalateAfter) out.push({ id: `${d.id}-esc`, at: addDays(effMaturity(d), s.config.escalateAfter), to: 'Regional Director', channel: 'Email', sev: 'critical', title: 'Escalated: unresolved matured deposit', detail: `${inst.name} has not acted ${-left} days after maturity`, depId: d.id, instId: inst.id, stage: 'Escalation' });
    }
    if ((d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker') && d.requestedOn) {
      const age = diffDays(t, d.requestedOn);
      if (age > s.config.bankSla) out.push({ id: `${d.id}-bk`, at: addDays(d.requestedOn, s.config.bankSla), to: d.bankName, channel: 'Bank API + email', sev: 'action', title: 'Verification reminder', detail: `${d.number} pending for ${age} days`, depId: d.id, instId: inst.id, stage: 'Reminder' });
      if (age > s.config.bankEscalate) out.push({ id: `${d.id}-bke`, at: addDays(d.requestedOn, s.config.bankEscalate), to: `${d.bankName} nodal officer + Regional Office`, channel: 'Email', sev: 'critical', title: 'Escalated: bank not responding', detail: `${d.number} unverified after ${age} days`, depId: d.id, instId: inst.id, stage: 'Escalation' });
    }
    if (d.verification === 'Mismatch' || d.verification === 'Not found') out.push({ id: `${d.id}-mm`, at: d.confirmed?.on || d.submittedOn, to: 'Institution + Regional Office', channel: 'Email', sev: 'critical', title: 'Discrepancy found', detail: `${d.number}: bank record differs from submission`, depId: d.id, instId: inst.id, stage: 'Discrepancy' });
  });
  return out.filter(a => a.at <= t).sort((a, b) => b.at.localeCompare(a.at));
}

export function stats(s: AppState) {
  const t = today(s);
  const byLife: Record<Life, { n: number; v: number }> = { Active: { n: 0, v: 0 }, Expiring: { n: 0, v: 0 }, Pending: { n: 0, v: 0 }, Matured: { n: 0, v: 0 }, Renewed: { n: 0, v: 0 }, Released: { n: 0, v: 0 } };
  s.deposits.forEach(d => { const l = life(d, s, t); byLife[l].n++; byLife[l].v += d.claimed.amountLakh; });
  const open = s.deposits.filter(isOpen);
  const held = open.filter(d => d.verification === 'Verified').reduce((a, d) => a + (d.confirmed?.amountLakh ?? 0), 0);
  return { byLife, open, held, t };
}

export const sevTone = (s: Sev) => (s === 'critical' ? 'bad' : s === 'action' ? 'warn' : 'info');

/** aggregate figures that are safe to show the public (no names, numbers or amounts per institution) */
export function summaryOf(s: AppState): PublicSummary {
  const x = stats(s); const life: Record<string, number> = {}; (Object.keys(x.byLife) as Life[]).forEach(k => { life[k] = x.byLife[k].n; });
  return { open: x.open.length, held: x.held, verified: x.open.filter(d => d.verification === 'Verified').length, total: s.deposits.length, totalVerified: s.deposits.filter(d => d.verification === 'Verified').length, life };
}
