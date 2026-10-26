// The nightly automation scan, shared by the server scheduler and the offline demo.
// It turns every reminder, overdue notice and escalation that has fallen due since the last scan
// into outgoing messages (email + SMS) and dashboard notices, and records the run in the audit trail.
import type { AppState, OutMsg } from './types';
import { alertsFor, today } from './rules';
import { addDays, uid } from './util';
import { pushAudit, pushNotice } from './actions';

export function runScan(s: AppState, by = 'SDFP scheduler'): { sent: OutMsg[]; reminders: number; escalations: number } {
  const t = today(s); s.outbox ||= [];
  const since = s.lastScan || addDays(t, -2);
  const known = new Set(s.outbox.map(m => m.key).filter(Boolean));
  const due = alertsFor(s).filter(a => !known.has(a.id));
  const sent: OutMsg[] = [];
  let reminders = 0, escalations = 0;
  for (const a of due) {
    const fresh = a.at > since;  // fell due since the previous scan
    const inst = s.institutions.find(i => i.id === a.instId)!;
    const status = fresh ? 'Queued' : 'Sent earlier (historical)';
    const mk = (channel: OutMsg['channel'], to: string, body: string): OutMsg => ({ id: uid('MSG'), at: fresh ? t : a.at, channel, to, subject: a.title, body, ref: a.depId, status, key: a.id });
    const msgs: OutMsg[] = [];
    if (a.to.includes('Institution')) { msgs.push(mk('Email', inst.email, `${a.detail}.`)); msgs.push(mk('SMS', inst.phone, `AICTE SDFP: ${a.title}. ${a.detail}.`)); }
    if (a.to.includes('Regional')) msgs.push(mk('Email', `${inst.region} Regional Office`, `${a.detail}.`));
    if (!a.to.includes('Institution') && !a.to.includes('Regional')) msgs.push(mk('Email', a.to, `${a.detail}.`));
    msgs.forEach((m, k) => { if (k > 0) m.key = `${a.id}#${k}`; });
    s.outbox.unshift(...msgs);
    if (fresh) {
      sent.push(...msgs);
      if (a.stage === 'Escalation') escalations++; else reminders++;
      if (a.to.includes('Institution')) pushNotice(s, { to: 'institution', instId: a.instId, title: a.title, body: a.detail, ref: a.depId, tone: a.sev === 'critical' ? 'bad' : a.sev === 'action' ? 'warn' : 'info' });
    }
  }
  s.outbox = s.outbox.slice(0, 2000);
  s.lastScan = t;
  if (sent.length) pushAudit(s, by, 'system', `Automated scan: ${reminders} reminder(s) and ${escalations} escalation(s) sent`);
  return { sent, reminders, escalations };
}
