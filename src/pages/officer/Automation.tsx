import { useMemo, useState } from 'react';
import { BellRing, CalendarClock, Database, Mail, MessageSquare, Play, Send, ShieldAlert, Sparkles, Timer, Workflow } from 'lucide-react';
import { useApp, instOf } from '../../lib/store';
import { alertsFor, today } from '../../lib/rules';
import { anomalyScores } from '../../lib/anomaly';
import { addDays, fmtDate } from '../../lib/util';
import { Badge, Chips, EmptyState, Kpi, PageHead, Pager, Panel } from '../../components/ui';
import { Pipeline } from '../../components/fx';

const JOBS: [string, string, string, string][] = [
  ['Nightly maturity scan', 'Every day, 02:00 IST', 'Finds reminders (90 / 30 / 7 days), overdue maturities and escalations that fell due, then emails and texts the institution and Regional Office.', 'nightly'],
  ['Bank SLA watch', 'Every day, 02:00 IST', 'Requests waiting longer than the bank service level are re-sent to the branch, then escalated to the nodal officer.', 'nightly'],
  ['Weekly status summary', 'Mondays, 09:00 IST', 'Open, expiring, pending and matured counts emailed to Regional Directors.', 'weekly'],
  ['Delivery worker', 'Continuous', 'Sends queued email through SMTP and SMS through the SMS gateway, and records the delivery status.', 'live'],
];

export default function Automation() {
  const { s, nav, runScanNow, toast, api } = useApp(); const t = today(s);
  const [ch, setCh] = useState<'all' | 'Email' | 'SMS' | 'fresh'>('all'); const [page, setPage] = useState(0); const [busy, setBusy] = useState(false);
  const out = s.outbox || [];
  const list = out.slice().sort((a, b) => b.at.localeCompare(a.at)).filter(m => ch === 'all' || (ch === 'fresh' ? !m.status.startsWith('Sent earlier') : m.channel === ch));
  const per = 15; const v = list.slice(page * per, page * per + per);
  const due = useMemo(() => alertsFor(s), [s]);
  const scores = useMemo(() => [...anomalyScores(s).entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 8), [s]);
  const today7 = out.filter(m => m.at > addDays(t, -7) && !m.status.startsWith('Sent earlier'));
  const run = async () => { setBusy(true); const r = await runScanNow(); setBusy(false); if (r) toast(r.sent ? `Scan complete: ${r.reminders} reminder(s), ${r.escalations} escalation(s), ${r.sent} message(s) sent.` : 'Scan complete: nothing new fell due since the last run.', r.sent ? 'good' : 'info'); };
  return (
    <>
      <PageHead title="Automation & outbox" sub="What the portal does by itself: scheduled scans, reminders, escalations and every message it has sent." crumbs={[{ label: 'Monitor' }, { label: 'Automation' }]}
        actions={<button className="btn primary" onClick={run} disabled={busy}><Play aria-hidden />{busy ? 'Scanning…' : 'Run scan now'}</button>} />
      <div className="kgrid">
        <Kpi icon={Send} color="linear-gradient(135deg,#2f6bff,#1739a8)" label="Messages in the last 7 days" value={today7.length} sub={`${today7.filter(m => m.channel === 'Email').length} email · ${today7.filter(m => m.channel === 'SMS').length} SMS`} />
        <Kpi icon={BellRing} color="linear-gradient(135deg,#ff9a3c,#e8700a)" label="Alerts tracked" value={due.length} sub={`${due.filter(a => a.stage === 'Escalation').length} escalations`} />
        <Kpi icon={Timer} color="linear-gradient(135deg,#16b35c,#0f8a45)" label="Last scan" value={s.lastScan ? fmtDate(s.lastScan) : 'Not yet'} sub={`Next: ${fmtDate(addDays(t, 1))}, 02:00`} />
        <Kpi icon={Sparkles} color="linear-gradient(135deg,#e05ca0,#b83280)" label="Unusual deposits" value={scores.filter(([, r]) => r.score >= 55).length} sub="Isolation Forest score 55 or more" tone="warn" />
        <Kpi icon={Database} color="linear-gradient(135deg,#7c4dff,#4c2bd1)" label="Runs on" value={api ? 'Server' : 'Browser'} sub={api ? 'node-cron scheduler, SQLite outbox' : 'Offline demo: same rules, local outbox'} />
      </div>
      <div style={{ height: 20 }} />
      <Panel title="How the nightly scan works" sub="Rules, not guesswork: every message can be traced to the rule that sent it">
        <Pipeline stages={[
          { label: 'Read register', sub: 'All open deposits', count: s.deposits.length, icon: Database, color: '#2f6bff' },
          { label: 'Compute due dates', sub: `${s.config.reminders.join(' / ')} days`, count: due.filter(a => a.stage !== 'Escalation').length, icon: CalendarClock, color: '#7c4dff' },
          { label: 'Escalate', sub: `${s.config.escalateAfter} days after maturity`, count: due.filter(a => a.stage === 'Escalation').length, icon: ShieldAlert, color: '#e05ca0' },
          { label: 'Send', sub: 'Email + SMS', count: out.length, icon: Mail, color: '#ff8a1f' },
          { label: 'Record', sub: 'Notice + audit entry', count: s.audit.filter(a => a.role === 'system').length, icon: Workflow, color: '#12a150' },
        ]} />
      </Panel>
      <div style={{ height: 20 }} />
      <div className="layout">
        <Panel className="s7" title="Scheduled jobs" flush>
          <div className="list">{JOBS.map(([a, when, what]) => <div key={a} className="li"><span className="mark good" /><div><div className="ttl">{a}</div><div className="meta">{what}</div></div><span className="faint nowrap">{when}</span></div>)}</div>
        </Panel>
        <Panel className="s5" title="Unusual deposits" sub="Isolation Forest, trained on this register. No labelled fraud data needed." flush
          foot={<span className="muted" style={{ fontSize: '.857rem' }}><Sparkles width={14} style={{ verticalAlign: -2 }} aria-hidden /> A high score means the deposit is easy to tell apart from the rest. It is a prompt to look, not a verdict.</span>}>
          <div className="list">{scores.length ? scores.map(([id, r]) => { const d = s.deposits.find(x => x.id === id)!; return <button key={id} className="li" onClick={() => nav('deposit', id)}><span className={`mark ${r.score >= 65 ? 'bad' : r.score >= 55 ? 'warn' : 'info'}`} /><div><div className="ttl mono">{d.number}</div><div className="meta">{instOf(s, d.instId).name}{r.reasons.length ? ` · ${r.reasons.join(', ')}` : ''}</div></div><b className="nowrap" style={{ color: 'var(--ink)' }}>{r.score}</b></button>; }) : <div className="empty">Not enough deposits to learn from yet.</div>}</div>
        </Panel>
      </div>
      <div style={{ height: 20 }} />
      <Panel title="Outbox" sub={api ? 'Every email and SMS the server has sent. Set SMTP_HOST and SMS_WEBHOOK to deliver to real inboxes and phones.' : 'Every email and SMS the portal would send'} flush
        actions={<Chips value={ch} onChange={x => { setCh(x); setPage(0); }} items={[{ id: 'all', label: 'All', count: out.length }, { id: 'fresh', label: 'Sent by scans' }, { id: 'Email', label: 'Email' }, { id: 'SMS', label: 'SMS' }]} />}>
        {v.length ? <div className="tw"><table className="t"><thead><tr><th>Date</th><th>Channel</th><th>To</th><th>Message</th><th>Status</th></tr></thead>
          <tbody>{v.map(m => <tr key={m.id}><td className="nowrap">{fmtDate(m.at)}</td><td>{m.channel === 'Email' ? <Badge tone="info"><Mail width={12} aria-hidden /> Email</Badge> : <Badge tone="neutral"><MessageSquare width={12} aria-hidden /> SMS</Badge>}</td><td><div className="nm" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.to}</div></td>
            <td><div className="nm">{m.subject}</div><div className="s2" style={{ maxWidth: 420 }}>{m.body}</div>{m.ref?.startsWith('SD-') && <button className="link mono" style={{ fontSize: '.8rem' }} onClick={() => nav('deposit', m.ref)}>{m.ref}</button>}</td>
            <td>{m.status.startsWith('Failed') ? <Badge tone="bad" icon>{m.status}</Badge> : m.status === 'Queued' ? <Badge tone="warn">Queued</Badge> : m.status.startsWith('Sent earlier') ? <Badge tone="neutral">Earlier</Badge> : <Badge tone="good" icon>{m.status}</Badge>}</td></tr>)}</tbody></table></div>
          : <EmptyState icon={Send} title="No messages yet" text="Run a scan, or move the demo date forward, to see reminders and escalations go out." />}
        <Pager page={page} pages={Math.ceil(list.length / per)} total={list.length} onPage={setPage} />
      </Panel>
    </>
  );
}
