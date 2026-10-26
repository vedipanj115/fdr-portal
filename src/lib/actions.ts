// Every change to the system goes through one of these actions.
// The same code runs on the server (real mode, SQLite) and in the browser (offline demo mode),
// so business rules, permissions and the audit trail are identical in both.
import type { AppState, AuditEntry, Deposit, Doc, Note, Notice, ReleaseReq, Role, User } from './types';
import { BANKS, regionOf } from './data';
import { addYears, diffDays, fmtDate, inr, inrFull, sha256, uid, addDays } from './util';
import { effMaturity, life, releaseChecks, today } from './rules';
import { nocPdf } from './docgen';

export class ActionError extends Error {}
function fail(m: string): never { throw new ActionError(m); }

export function pushAudit(s: AppState, actor: string, role: AuditEntry['role'], action: string, ref = '') {
  const prev = s.audit.length ? s.audit[s.audit.length - 1].hash : '0'.repeat(64);
  const at = `${today(s)}T${new Date().toTimeString().slice(0, 8)}`;
  const hash = sha256(`${prev}|${at}|${actor}|${action}|${ref}`);
  s.audit.push({ seq: s.audit.length + 1, at, actor, role, action, ref, prev, hash });
}
export function pushNotice(s: AppState, n: Omit<Notice, 'id' | 'at'>) { s.notices.unshift({ ...n, id: uid('NT'), at: today(s) }); }
export const nextId = (ds: Deposit[], t: string) => `SD-${t.slice(0, 4)}-${String(Math.max(0, ...ds.map(d => +d.id.slice(-5) || 0)) + 1).padStart(5, '0')}`;

export interface Ctx {
  /** stores a file (server: encrypted on disk) and returns its fingerprint */
  saveFile(bytes: Uint8Array, mime: string, name: string): Promise<{ id: string; sha256: string; sizeKb: number }>;
  fileInfo(id: string): Promise<{ sha256: string; sizeKb: number; mime: string } | null>;
  /** core-banking lookup (server: HTTP call to the bank's CBS API) */
  cbsLookup(number: string, ifsc: string, bankCode: string): Promise<{ found: boolean; amountLakh?: number; maturity?: string; lien?: boolean; holder?: string }>;
  /** demo only: the specimen generator registers the bank's own record in the mock CBS */
  cbsRegister(rec: { number: string; ifsc: string; amountLakh: number; maturity: string; lien: boolean; holder: string }): Promise<void>;
  verifyOtp(purpose: string, ref: string, otp: string): Promise<boolean>;
  /** payment gateway (server: HTTP call to the gateway, then settlement) */
  pay(amountLakh: number, ref: string, payer: string): Promise<{ txnId: string; settled: boolean }>;
  /** fires after actions that should notify people (server: email/SMS outbox) */
  notify?(to: string, channel: 'Email' | 'SMS', subject: string, body: string, ref?: string): void;
}

type Act = { roles: Role[] | 'any'; run: (s: AppState, u: User, p: Record<string, unknown>, ctx: Ctx) => Promise<unknown> | unknown };
const dep = (s: AppState, id: unknown) => s.deposits.find(d => d.id === id) || fail('Deposit not found.');
const inst = (s: AppState, id: string) => s.institutions.find(i => i.id === id)!;
const own = (u: User, d: Deposit) => {
  if (u.role === 'institution' && d.instId !== u.instId) fail('This deposit belongs to another institution.');
  if (u.role === 'bank' && d.bankCode !== u.bankCode) fail('This deposit is with another bank.');
};
const str = (v: unknown, name: string, max = 2000) => { const x = String(v ?? '').trim(); if (!x) fail(`${name} is required.`); if (x.length > max) fail(`${name} is too long.`); return x; };
const isoDate = (v: unknown, name: string) => { const x = String(v ?? ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(x)) fail(`${name} must be a date.`); return x; };
const posNum = (v: unknown, name: string) => { const x = Number(v); if (!isFinite(x) || x <= 0) fail(`${name} must be a positive number.`); return x; };

export const ACTIONS: Record<string, Act> = {
  /* ---------- general ---------- */
  'audit.log': { roles: 'any', run: (s, u, p) => { pushAudit(s, u.name, u.role, str(p.action, 'Action', 300), String(p.ref || '')); } },
  'demo.setOffset': { roles: 'any', run: (s, u, p) => { const n = Math.max(0, Math.min(3650, Math.round(Number(p.offset) || 0))); s.offset = n; pushAudit(s, u.name, u.role, `Demo: system date set to ${fmtDate(today(s))}`); } },

  /* Quick Scan: checks a QR sticker against the register (the sticker carries the record's fingerprint) */
  'scan.verify': {
    roles: 'any', run: (s, u, p) => {
      const q = str(p.code, 'Code', 400).split('|'); const d = q[0] === 'SDFP1' ? s.deposits.find(x => x.id === q[1]) : undefined;
      const ok = !!d && d.number === q[2] && d.hashStored.slice(0, 12) === q[4];
      pushAudit(s, u.name, u.role, ok ? `Quick Scan: sticker genuine for ${d!.number}` : `Quick Scan: forged or unknown sticker${q[2] ? ' claiming ' + q[2] : ''}`, ok ? d!.id : '');
      if (!ok) return { genuine: false, claimed: q[0] === 'SDFP1' ? q[2] : undefined };
      const i = inst(s, d!.instId); return { genuine: true, depId: d!.id, number: d!.number, inst: i.name, city: i.city, life: life(d!, s) };
    },
  },

  /* ---------- institution ---------- */
  'deposit.submitFdr': {
    roles: ['institution'], run: async (s, u, p, ctx) => {
      const i = inst(s, u.instId!); const t = today(s);
      const number = str(p.number, 'FDR number', 30).toUpperCase(); const ifsc = str(p.ifsc, 'IFSC', 11).toUpperCase();
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) fail('IFSC must look like ABCD0123456.');
      const amountLakh = posNum(p.amountLakh, 'Amount'); const issue = isoDate(p.issue, 'Issue date'); const maturity = isoDate(p.maturity, 'Maturity date');
      if (maturity <= issue) fail('Maturity must be after the issue date.');
      const code = ifsc.slice(0, 4); const bank = BANKS[code];
      const twin = s.deposits.find(x => x.number === number && x.ifsc === ifsc && !x.replacedBy && !(x.release && x.release.status === 'Lien released'));
      if (twin) { pushAudit(s, 'SDFP duplicate check', 'system', `Blocked duplicate submission of FDR ${number} by ${i.name} (already on record as ${twin.id})`, twin.id); fail(`Duplicate FDR: ${number} is already pledged on record${twin.instId === i.id ? ' for your institution' : ' by another institution'}. The same receipt cannot be used twice.`); }
      const old = p.replaces ? dep(s, p.replaces) : undefined; if (old) own(u, old);
      const docs: Doc[] = [];
      let hash = sha256(`FDR|${number}|${amountLakh}|${issue}|${maturity}`);
      if (p.fileId) { const fi = await ctx.fileInfo(String(p.fileId)) || fail('Uploaded file not found.'); hash = fi.sha256; docs.push({ id: String(p.fileId), name: String(p.fileName || `FDR_${number}.pdf`), kind: 'FDR', uploadedOn: t, by: u.name, sha256: fi.sha256, sizeKb: fi.sizeKb, mime: fi.mime }); }
      if (p.affidavitFileId) { const fa = await ctx.fileInfo(String(p.affidavitFileId)); if (fa) docs.push({ id: String(p.affidavitFileId), name: String(p.affidavitName || 'Affidavit.pdf'), kind: 'Affidavit', uploadedOn: t, by: u.name, sha256: fa.sha256, sizeKb: fa.sizeKb, mime: fa.mime }); }
      else if (p.affidavitSpecimen) docs.push({ id: uid('DOC'), name: 'Affidavit_Format2_specimen.pdf', kind: 'Affidavit', uploadedOn: t, by: u.name, sha256: sha256('AFF' + number + t), sizeKb: 120, generated: true });
      if (p.bankRecord && typeof p.bankRecord === 'object') { const b = p.bankRecord as { amountLakh: number; maturity: string; lien: boolean }; await ctx.cbsRegister({ number, ifsc, amountLakh: b.amountLakh, maturity: b.maturity, lien: b.lien, holder: i.name }); }
      const id = nextId(s.deposits, t); const reg = regionOf(i.region);
      const d: Deposit = { id, instId: i.id, kind: 'FDR', number, bankCode: code, bankName: bank?.name || 'Unknown bank', ifsc, branch: String(p.branch || 'Main').slice(0, 80), claimed: { amountLakh, issue, maturity },
        verification: bank?.scheduled ? 'Awaiting bank' : 'Not found', requestedOn: t, submittedOn: t, affidavit: docs.some(x => x.kind === 'Affidavit'), docs, notes: [], hashStored: hash, hashCurrent: hash,
        custody: { state: 'In transit to RO', locker: `${reg.code}-L${String(20 + (s.deposits.length % 9)).padStart(2, '0')}`, since: t }, replaces: old?.id };
      s.deposits.push(d);
      pushAudit(s, u.name, 'institution', `${old ? 'Submitted renewal' : 'Submitted FDR'} ${number} (${p.readBy || 'typed'}; SHA-256 ${hash.slice(0, 12)}…)`, id);
      pushNotice(s, { to: 'bank', bankCode: code, title: `New FDR to confirm: ${number}`, body: `${i.name}, routed by IFSC ${ifsc}`, ref: id, tone: 'info' });
      pushNotice(s, { to: 'institution', instId: i.id, title: `Submitted ${number}`, body: `Sent to ${d.bankName} for independent confirmation. Post the original FDR to the ${i.region} Regional Office.`, ref: id, tone: 'info' });
      ctx.notify?.(`${d.bankName} (branch ${ifsc})`, 'Email', `Confirm FDR ${number} pledged to AICTE`, `Please confirm amount, maturity and lien for FDR ${number} (${i.name}) on the SDFP bank desk.`, id);
      ctx.notify?.(i.email, 'Email', `SDFP: ${number} received`, `Your FDR ${number} was submitted and sent to ${d.bankName} for confirmation.`, id);
      return { id };
    },
  },
  'deposit.payOnline': {
    roles: ['institution'], run: async (s, u, p, ctx) => {
      const i = inst(s, u.instId!); const t = today(s); const a = posNum(p.amountLakh, 'Amount');
      const old = p.replaces ? dep(s, p.replaces) : undefined; if (old) own(u, old);
      const ref = `AICTE-SD-${t.slice(0, 4)}-${String(10000 + s.deposits.length).padStart(5, '0')}`;
      const pay = await ctx.pay(a, ref, i.name); if (!pay.settled) fail('Payment was not settled by the gateway.');
      const h = sha256(`ONL|${ref}|${a}|${t}|${pay.txnId}`); const id = nextId(s.deposits, t);
      s.deposits.push({ id, instId: i.id, kind: 'Online', number: ref, bankCode: 'AICTE', bankName: 'AICTE account (payment gateway)', ifsc: '', branch: 'Online payment', claimed: { amountLakh: a, issue: t, maturity: addYears(t, 10) },
        confirmed: { amountLakh: a, maturity: addYears(t, 10), lien: true, on: t, by: 'Payment gateway reconciliation', via: `Gateway settlement, txn ${pay.txnId}` }, verification: 'Verified', requestedOn: t, submittedOn: t, affidavit: !!p.affidavit,
        docs: [{ id: uid('DOC'), name: `Receipt_${ref}.pdf`, kind: 'Payment receipt', uploadedOn: t, by: 'Payment gateway', sha256: h, sizeKb: 84, generated: true }], notes: [], hashStored: h, hashCurrent: h, replaces: old?.id });
      if (old) dep(s, old.id).replacedBy = id;
      pushAudit(s, u.name, 'institution', `Paid security deposit online ${ref} (${inr(a)}); gateway txn ${pay.txnId} reconciled automatically`, id);
      ctx.notify?.(i.email, 'Email', `Payment received: ${ref}`, `${inrFull(a)} received and reconciled with the AICTE account.`, id);
      return { id, ref, txnId: pay.txnId };
    },
  },
  'deposit.requestRelease': {
    roles: ['institution'], run: (s, u, p, ctx) => {
      const d = dep(s, p.depId); own(u, d); if (d.release && d.release.status !== 'Rejected') fail('A release request is already open.');
      if (d.verification !== 'Verified') fail('Only a bank-verified instrument can be released.');
      const reason = String(p.reason) as ReleaseReq['reason']; if (!['10-year term completed', 'Institution closed', 'Merger', 'Replaced by online deposit'].includes(reason)) fail('Choose a valid reason.');
      d.release = { reason, requestedOn: today(s), status: 'Requested', letter: !!p.letter };
      if (p.letter) d.docs.push({ id: uid('DOC'), name: 'Release_request_letter.pdf', kind: 'Release request letter', uploadedOn: today(s), by: u.name, sha256: sha256('letter' + d.id + today(s)), sizeKb: 96, generated: true });
      pushAudit(s, u.name, 'institution', `Requested release of ${d.number} (${reason})`, d.id);
      pushNotice(s, { to: 'officer', title: `Release requested: ${d.number}`, body: inst(s, d.instId).name, ref: d.id, tone: 'info' });
      ctx.notify?.(`${inst(s, d.instId).region} Regional Office`, 'Email', `Release requested: ${d.number}`, `${inst(s, d.instId).name} requested release (${reason}).`, d.id);
    },
  },
  'deposit.addDoc': {
    roles: ['institution', 'officer'], run: async (s, u, p, ctx) => {
      const d = dep(s, p.depId); own(u, d); const fi = await ctx.fileInfo(String(p.fileId)) || fail('Uploaded file not found.');
      const kind = String(p.kind) as Doc['kind']; if (!['Affidavit', 'FDR', 'Release request letter', 'Bank confirmation'].includes(kind)) fail('Unknown document type.');
      d.docs.push({ id: String(p.fileId), name: String(p.name || 'document').slice(0, 120), kind, uploadedOn: today(s), by: u.name, sha256: fi.sha256, sizeKb: fi.sizeKb, mime: fi.mime });
      if (kind === 'Affidavit') d.affidavit = true;
      pushAudit(s, u.name, u.role, `Uploaded ${kind.toLowerCase()} for ${d.number} (SHA-256 ${fi.sha256.slice(0, 12)}…)`, d.id);
    },
  },
  'deposit.addNote': {
    roles: 'any', run: (s, u, p, ctx) => {
      const d = dep(s, p.depId); own(u, d); const text = str(p.text, 'Note', 2000);
      const allowed: Record<Role, Note['kind'][]> = { officer: ['Observation', 'Discrepancy notice'], institution: ['Institution reply'], bank: ['Bank remark'] };
      const kind = String(p.kind) as Note['kind']; if (!allowed[u.role].includes(kind)) fail('You cannot add that kind of note.');
      d.notes.push({ id: uid('N'), on: today(s), by: u.name, role: u.role, kind, text });
      pushAudit(s, u.name, u.role, `${kind} on ${d.number}`, d.id);
      if (kind === 'Discrepancy notice') { pushNotice(s, { to: 'institution', instId: d.instId, title: `Notice on ${d.number}`, body: text, ref: d.id, tone: 'bad' }); ctx.notify?.(inst(s, d.instId).email, 'Email', `AICTE notice on ${d.number}`, text, d.id); ctx.notify?.(inst(s, d.instId).phone, 'SMS', `AICTE notice`, `AICTE has raised a notice on FDR ${d.number}. Log in to SDFP to reply.`, d.id); }
      if (kind === 'Institution reply') pushNotice(s, { to: 'officer', title: `Reply on ${d.number}`, body: text, ref: d.id, tone: 'info' });
    },
  },

  /* ---------- officer ---------- */
  'deposit.requestVerification': {
    roles: ['officer'], run: (s, u, p, ctx) => {
      const d = dep(s, p.depId); if (!['Not requested', 'Not found'].includes(d.verification)) fail('Verification is already in progress.');
      d.verification = 'Awaiting bank'; d.requestedOn = today(s);
      pushAudit(s, u.name, 'officer', `Requested bank verification for ${d.number}`, d.id);
      pushNotice(s, { to: 'bank', bankCode: d.bankCode, title: `Verification requested: ${d.number}`, body: 'Confirm amount, maturity and lien from core banking', ref: d.id, tone: 'info' });
      ctx.notify?.(`${d.bankName} nodal officer`, 'Email', `Verification request: ${d.number}`, 'Please confirm this FDR on the SDFP bank desk.', d.id);
    },
  },
  'deposit.remindBank': {
    roles: ['officer'], run: (s, u, p, ctx) => {
      const d = dep(s, p.depId);
      pushAudit(s, u.name, 'officer', `Sent reminder to ${d.bankName} for ${d.number}`, d.id);
      pushNotice(s, { to: 'bank', bankCode: d.bankCode, title: `Reminder: confirm ${d.number}`, body: `Pending since ${fmtDate(d.requestedOn)}`, ref: d.id, tone: 'warn' });
      ctx.notify?.(`${d.bankName} nodal officer`, 'Email', `Reminder: confirm ${d.number}`, `Pending since ${fmtDate(d.requestedOn)}.`, d.id);
    },
  },
  'verify.remindAll': {
    roles: ['officer'], run: (s, u, _p, ctx) => {
      const t = today(s); const late = s.deposits.filter(d => (d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker') && d.requestedOn && diffDays(t, d.requestedOn) > s.config.bankSla);
      late.forEach(d => { pushNotice(s, { to: 'bank', bankCode: d.bankCode, title: `Reminder: confirm ${d.number}`, body: `Pending ${diffDays(t, d.requestedOn!)} days`, ref: d.id, tone: 'warn' }); ctx.notify?.(`${d.bankName} nodal officer`, 'Email', `Reminder: confirm ${d.number}`, `Pending ${diffDays(t, d.requestedOn!)} days against an SLA of ${s.config.bankSla}.`, d.id); });
      pushAudit(s, u.name, 'officer', `Sent ${late.length} verification reminders to banks`);
      return { count: late.length };
    },
  },
  'deposit.closeScrutiny': { roles: ['officer'], run: (s, u, p) => { const d = dep(s, p.depId); if (d.verification !== 'Verified') fail('Only verified deposits can be closed.'); if (!s.scrutinyClosed.includes(d.id)) s.scrutinyClosed.push(d.id); pushAudit(s, u.name, 'officer', `Marked scrutiny complete for ${d.number}`, d.id); } },
  'deposit.editFields': {
    roles: ['officer'], run: (s, u, p) => {
      const d = dep(s, p.depId); const reason = str(p.reason, 'Reason', 300); const ch: string[] = [];
      const branch = String(p.branch ?? d.branch).slice(0, 80); if (d.branch !== branch) { ch.push(`branch "${d.branch}" → "${branch}"`); d.branch = branch; }
      if (d.custody && p.locker && d.custody.locker !== p.locker) { ch.push(`locker ${d.custody.locker} → ${p.locker}`); d.custody.locker = String(p.locker).slice(0, 20); }
      pushAudit(s, u.name, 'officer', `Edited ${d.number}: ${ch.join(', ') || 'no change'} (reason: ${reason})`, d.id);
    },
  },
  'vault.move': {
    roles: ['officer'], run: (s, u, p) => {
      const d = dep(s, p.depId); if (!d.custody) fail('No paper original for this deposit.'); const action = p.action === 'Checked out' ? 'Checked out' : 'Checked in'; const reason = action === 'Checked out' ? str(p.reason, 'Reason', 120) : 'Returned to locker';
      d.custody = { ...d.custody, state: action === 'Checked out' ? 'Checked out' : 'In locker', since: today(s), reason: action === 'Checked out' ? reason : undefined };
      s.vault.push({ at: today(s), depId: d.id, locker: d.custody.locker, action, by: u.name, reason });
      pushAudit(s, u.name, 'officer', `${action} original ${d.number} at ${d.custody.locker}`, d.id);
    },
  },
  'config.save': {
    roles: ['officer'], run: (s, u, p) => {
      const rem = (Array.isArray(p.reminders) ? p.reminders : []).map(Number).filter(n => n > 0 && n < 400); if (!rem.length) fail('Add at least one reminder.');
      const n = (v: unknown, d: number) => Math.max(1, Math.min(365, Math.round(Number(v) || d)));
      s.config = { ...s.config, reminders: [...new Set(rem)].sort((a, b) => b - a), escalateAfter: n(p.escalateAfter, 15), bankSla: n(p.bankSla, 7), bankEscalate: n(p.bankEscalate, 14) };
      pushAudit(s, u.name, 'officer', `Changed reminder rules: ${s.config.reminders.join('/')} days; escalate after ${s.config.escalateAfter}; bank SLA ${s.config.bankSla}/${s.config.bankEscalate}`);
    },
  },
  'release.clearComplaints': { roles: ['officer'], run: (s, u, p) => { const d = dep(s, p.depId); const i = inst(s, d.instId); i.openComplaints = 0; pushAudit(s, u.name, 'officer', `Recorded complaints of ${i.name} as resolved (grievance cell report)`, d.id); } },
  'release.approve': {
    roles: ['officer'], run: async (s, u, p, ctx) => {
      const d = dep(s, p.depId); if (d.release?.status !== 'Requested') fail('No open release request.');
      if (!(await ctx.verifyOtp('release', d.id, String(p.otp || '')))) fail('That OTP is not correct or has expired.');
      const ch = releaseChecks(d, s); if (!ch.every(c => c.ok)) fail('Not every release condition is met.');
      const i = inst(s, d.instId); const on = today(s); const hash = sha256(`NOC|${d.id}|${on}|${u.name}`);
      const bytes = nocPdf({ inst: i.name, city: i.city, number: d.number, bank: d.bankName, amount: inrFull(d.confirmed?.amountLakh ?? d.claimed.amountLakh), issue: d.claimed.issue, maturity: effMaturity(d), reason: d.release.reason, checks: ch, approver: `${u.name}, ${u.designation}`, on, hash, ref: `SDFP/NOC/${d.id}` });
      const f = await ctx.saveFile(bytes, 'application/pdf', `NOC_${d.id}.pdf`);
      d.release.status = 'Approved'; d.release.approvedOn = on; d.release.approvedBy = u.name; d.release.nocHash = f.sha256;
      d.docs.push({ id: f.id, name: `NOC_${d.id}.pdf`, kind: 'NOC', uploadedOn: on, by: u.name, sha256: f.sha256, sizeKb: f.sizeKb, mime: 'application/pdf' });
      pushAudit(s, u.name, 'officer', `Approved release of ${d.number} with OTP; NOC issued (SHA-256 ${f.sha256.slice(0, 12)}…)`, d.id);
      pushNotice(s, { to: 'institution', instId: d.instId, title: 'Release approved', body: `NOC issued for ${d.number}. The bank will release the lien.`, ref: d.id, tone: 'good' });
      pushNotice(s, { to: 'bank', bankCode: d.bankCode, title: `Release lien on ${d.number}`, body: 'NOC issued by AICTE', ref: d.id, tone: 'info' });
      ctx.notify?.(i.email, 'Email', `NOC issued for ${d.number}`, 'Your release request was approved. The NOC is attached in SDFP.', d.id);
      ctx.notify?.(`${d.bankName} (${d.ifsc})`, 'Email', `Release lien on ${d.number}`, `AICTE has issued NOC ${f.sha256.slice(0, 16)}… for this FDR.`, d.id);
      return { nocId: f.id };
    },
  },
  'release.reject': {
    roles: ['officer'], run: (s, u, p, ctx) => {
      const d = dep(s, p.depId); if (d.release?.status !== 'Requested') fail('No open release request.'); const why = str(p.reason, 'Reason', 500);
      d.release.status = 'Rejected'; pushAudit(s, u.name, 'officer', `Rejected release of ${d.number}: ${why}`, d.id);
      pushNotice(s, { to: 'institution', instId: d.instId, title: 'Release request rejected', body: why, ref: d.id, tone: 'bad' });
      ctx.notify?.(inst(s, d.instId).email, 'Email', `Release request rejected: ${d.number}`, why, d.id);
    },
  },

  /* ---------- bank ---------- */
  'bank.cbsFetch': {
    roles: ['bank'], run: async (s, u, p, ctx) => {
      if (u.bankRole !== 'maker') fail('Only the branch officer (maker) fetches from core banking.');
      const d = dep(s, p.depId); own(u, d); const r = await ctx.cbsLookup(d.number, d.ifsc, d.bankCode);
      pushAudit(s, u.name, 'bank', `Fetched ${d.number} from core banking (CBS API): ${r.found ? 'record found' : 'no record'}`, d.id);
      return r;
    },
  },
  'bank.toChecker': {
    roles: ['bank'], run: (s, u, p) => {
      if (u.bankRole !== 'maker') fail('Only the maker can prepare a confirmation.');
      const d = dep(s, p.depId); own(u, d); if (d.verification !== 'Awaiting bank') fail('This FDR is not waiting for the maker.');
      d.maker = { amountLakh: posNum(p.amountLakh, 'Amount'), maturity: isoDate(p.maturity, 'Maturity'), lien: !!p.lien, on: today(s), by: u.name, via: 'Core banking fetch' };
      d.verification = 'Awaiting checker'; pushAudit(s, u.name, 'bank', `Prepared confirmation of ${d.number}; sent to checker`, d.id);
    },
  },
  'bank.notFound': {
    roles: ['bank'], run: (s, u, p, ctx) => {
      const d = dep(s, p.depId); own(u, d); d.verification = 'Not found'; d.confirmed = undefined;
      s.esign.push({ at: today(s), depId: d.id, number: d.number, by: u.name, result: 'Not found', hash: sha256(`${d.number}|NOTFOUND|${today(s)}`), bankCode: d.bankCode });
      pushAudit(s, u.name, 'bank', `Reported ${d.number}: no such FDR in core banking`, d.id);
      pushNotice(s, { to: 'officer', title: `Bank could not find ${d.number}`, body: inst(s, d.instId).name, ref: d.id, tone: 'bad' });
      ctx.notify?.(`${inst(s, d.instId).region} Regional Office`, 'Email', `Bank could not find ${d.number}`, `${d.bankName} reports no such FDR. Possible forged instrument.`, d.id);
    },
  },
  'bank.sign': {
    roles: ['bank'], run: async (s, u, p, ctx) => {
      if (u.bankRole !== 'checker') fail('Only the branch manager (checker) can sign.');
      const d = dep(s, p.depId); own(u, d); if (d.verification !== 'Awaiting checker' || !d.maker) fail('Nothing to sign for this FDR.');
      if (!(await ctx.verifyOtp('esign', d.id, String(p.otp || '')))) fail('That OTP is not correct or has expired.');
      const m = d.maker; const ok = Math.abs(m.amountLakh - d.claimed.amountLakh) < 0.001 && m.maturity === d.claimed.maturity && m.lien;
      const h = sha256(JSON.stringify({ fdr: d.number, amount: m.amountLakh, maturity: m.maturity, lien: m.lien, bank: d.bankName, at: today(s), by: u.name }));
      d.confirmed = { amountLakh: m.amountLakh, maturity: m.maturity, lien: m.lien, on: today(s), by: `${d.bankName}, ${d.branch}`, via: 'Bank confirmation desk (maker-checker, OTP e-sign)' };
      d.verification = ok ? 'Verified' : 'Mismatch';
      if (ok && d.replaces) { const o = s.deposits.find(z => z.id === d.replaces); if (o) o.replacedBy = d.id; }
      s.esign.push({ at: today(s), depId: d.id, number: d.number, by: u.name, result: ok ? 'Verified' : 'Values differ', hash: h, bankCode: d.bankCode });
      const i = inst(s, d.instId);
      pushAudit(s, u.name, 'bank', `E-signed confirmation of ${d.number}: ${ok ? 'values match' : 'values differ from submission'}`, d.id);
      pushNotice(s, { to: 'institution', instId: d.instId, title: ok ? `${d.number} confirmed by ${d.bankName}` : `Discrepancy on ${d.number}`, body: ok ? 'Your deposit is verified and now tracked to maturity.' : 'The bank’s record differs from what you submitted. AICTE will contact you.', ref: d.id, tone: ok ? 'good' : 'bad' });
      if (!ok) { pushNotice(s, { to: 'officer', title: `Discrepancy: ${d.number}`, body: `${i.name}: bank values differ from submission`, ref: d.id, tone: 'bad' }); ctx.notify?.(`${i.region} Regional Office`, 'Email', `Discrepancy on ${d.number}`, `${d.bankName} confirmed values that differ from ${i.name}'s submission.`, d.id); }
      ctx.notify?.(i.email, 'Email', ok ? `${d.number} verified` : `Discrepancy on ${d.number}`, ok ? 'The bank confirmed your FDR.' : 'The bank’s record differs from your submission.', d.id);
      return { result: ok ? 'Verified' : 'Mismatch' };
    },
  },
  'bank.sendBack': { roles: ['bank'], run: (s, u, p) => { if (u.bankRole !== 'checker') fail('Only the checker can send back.'); const d = dep(s, p.depId); own(u, d); d.verification = 'Awaiting bank'; d.maker = undefined; pushAudit(s, u.name, 'bank', `Returned ${d.number} to maker`, d.id); } },
  'bank.releaseLien': {
    roles: ['bank'], run: async (s, u, p, ctx) => {
      const d = dep(s, p.depId); own(u, d); if (d.release?.status !== 'Approved') fail('No NOC for this FDR.');
      if (!(await ctx.verifyOtp('lien', d.id, String(p.otp || '')))) fail('That OTP is not correct or has expired.');
      d.release.status = 'Lien released'; d.release.lienReleasedOn = today(s);
      if (d.custody) d.custody = { ...d.custody, state: 'Checked out', since: today(s), reason: 'Handed to bank after NOC' };
      pushAudit(s, u.name, 'bank', `Released lien on ${d.number}; principal to Trust / Society account`, d.id);
      pushNotice(s, { to: 'institution', instId: d.instId, title: `Lien released on ${d.number}`, body: 'The principal is payable to your registered account.', ref: d.id, tone: 'good' });
      pushNotice(s, { to: 'officer', title: `Lien released: ${d.number}`, body: inst(s, d.instId).name, ref: d.id, tone: 'good' });
      ctx.notify?.(inst(s, d.instId).email, 'Email', `Lien released on ${d.number}`, 'The principal is payable to your registered account.', d.id);
    },
  },
};

/* Run one action against a state copy. Throws ActionError for any rule violation. */
export async function runAction(s: AppState, u: User, name: string, payload: Record<string, unknown>, ctx: Ctx) {
  const a = ACTIONS[name]; if (!a) fail(`Unknown action ${name}.`);
  if (a.roles !== 'any' && !a.roles.includes(u.role)) fail('You do not have permission to do that.');
  return a.run(s, u, payload || {}, ctx);
}

/* Automation scan: what the nightly job does. Returns the alerts that should go out now. */
export { addDays };
