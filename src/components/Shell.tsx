import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Workflow, Bell, BellRing, Building2, CalendarClock, FileBarChart, FileCheck2, LayoutDashboard, LogOut, Plug, ScrollText, Search, SlidersHorizontal, Table2, Archive, BadgeCheck, Upload, RefreshCcw, FileText, Inbox, KeyRound, ListChecks, PenLine, FolderOpen, Clock3, ChevronDown, ScanLine, UserCog, Menu } from 'lucide-react';
import { useApp } from '../lib/store';
import { allFlags, flagsOf, isOpen, today } from '../lib/rules';
import { addDays, diffDays, fmtDate } from '../lib/util';
import { Brand, GovFooter, GovStrip, Toasts } from './Chrome';
import QuickScan from './QuickScan';
import type { Role } from '../lib/types';

type Item = { id: string; label: string; icon: typeof Bell; count?: number; bad?: boolean };
export function useNav(): { group: string; items: Item[] }[] {
  const { s, user } = useApp();
  return useMemo(() => {
    if (!user) return [];
    const t = today(s);
    if (user.role === 'officer') {
      const fl = allFlags(s);
      const pend = s.deposits.filter(d => isOpen(d) && d.verification !== 'Verified').length;
      const exp = s.deposits.filter(d => isOpen(d) && d.verification === 'Verified' && !d.release && diffDays(d.claimed.maturity, t) <= Math.max(...s.config.reminders)).length;
      const rel = s.deposits.filter(d => d.release && d.release.status === 'Requested').length;
      return [
        { group: 'Monitor', items: [{ id: 'home', label: 'Overview', icon: LayoutDashboard }, { id: 'alerts', label: 'Alerts & escalations', icon: BellRing, count: fl.filter(f => f.sev === 'critical').length, bad: true }, { id: 'automation', label: 'Automation & outbox', icon: Workflow }] },
        { group: 'Records', items: [{ id: 'register', label: 'Deposit register', icon: Table2 }, { id: 'institutions', label: 'Institutions', icon: Building2 }, { id: 'vault', label: 'FDR vault', icon: Archive }] },
        { group: 'Workflows', items: [{ id: 'verify', label: 'Verification queue', icon: BadgeCheck, count: pend }, { id: 'maturity', label: 'Maturity & renewals', icon: CalendarClock, count: exp }, { id: 'releases', label: 'Release requests', icon: FileCheck2, count: rel }] },
        { group: 'Governance', items: [{ id: 'reports', label: 'Reports', icon: FileBarChart }, { id: 'audit', label: 'Audit trail', icon: ScrollText }, { id: 'integrations', label: 'Integrations & security', icon: Plug }, { id: 'settings', label: 'Reminder settings', icon: SlidersHorizontal }] },
      ];
    }
    if (user.role === 'institution') {
      const mine = s.deposits.filter(d => d.instId === user.instId);
      const n = mine.flatMap(d => flagsOf(d, s, t)).filter(f => f.sev !== 'info').length;
      return [
        { group: 'My institution', items: [{ id: 'home', label: 'Dashboard', icon: LayoutDashboard, count: n || undefined, bad: true }, { id: 'deposits', label: 'My deposits', icon: Table2, count: mine.filter(isOpen).length }, { id: 'notices', label: 'Notices', icon: Bell }] },
        { group: 'Apply', items: [{ id: 'submit', label: 'Submit deposit', icon: Upload }, { id: 'renew', label: 'Renew or replace', icon: RefreshCcw }, { id: 'release', label: 'Release request', icon: FileText }, { id: 'documents', label: 'Documents', icon: FolderOpen }] },
      ];
    }
    const mine = s.deposits.filter(d => d.bankCode === user.bankCode);
    const q = mine.filter(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker').length;
    const lien = mine.filter(d => d.release?.status === 'Approved').length;
    return [
      { group: 'Branch desk', items: [{ id: 'home', label: 'Dashboard', icon: LayoutDashboard }, { id: 'desk', label: 'Confirmation desk', icon: Inbox, count: q, bad: true }, { id: 'lien', label: 'Lien release', icon: KeyRound, count: lien }] },
      { group: 'Records', items: [{ id: 'bulk', label: 'Bulk verification', icon: ListChecks }, { id: 'esign', label: 'E-sign log', icon: PenLine }] },
    ];
  }, [s, user]);
}

function usePop() {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); }; const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false); document.addEventListener('mousedown', h); document.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); }; }, [open]);
  return { open, setOpen, ref };
}

function GlobalSearch() {
  const { s, nav, user } = useApp(); const [q, setQ] = useState(''); const p = usePop();
  const res = useMemo(() => {
    const k = q.trim().toLowerCase(); if (k.length < 2) return [];
    const deps = s.deposits.filter(d => (user?.role !== 'bank' || d.bankCode === user.bankCode) && (d.number.toLowerCase().includes(k) || d.id.toLowerCase().includes(k))).slice(0, 5)
      .map(d => ({ key: d.id, t: `${d.number} · ${d.id}`, sub: s.institutions.find(i => i.id === d.instId)!.name, go: () => nav('deposit', d.id) }));
    const insts = user?.role === 'officer' ? s.institutions.filter(i => i.name.toLowerCase().includes(k) || i.aicteId.includes(k) || i.city.toLowerCase().includes(k)).slice(0, 5).map(i => ({ key: i.id, t: i.name, sub: `${i.city} · ${i.aicteId}`, go: () => nav('institution', i.id) })) : [];
    return [...insts, ...deps];
  }, [q, s, nav, user]);
  return (
    <div className="search" ref={p.ref}>
      <Search aria-hidden /><input className="input" placeholder={user?.role === 'officer' ? 'Search institution, FDR no., city' : 'Search FDR number'} value={q} onChange={e => { setQ(e.target.value); p.setOpen(true); }} onFocus={() => p.setOpen(true)} aria-label="Search records" />
      {p.open && q.trim().length >= 2 && <div className="searchpop">{res.length ? res.map(r => <button key={r.key} onClick={() => { r.go(); setQ(''); p.setOpen(false); }}><span>{r.t}</span><small>{r.sub}</small></button>) : <div className="empty">No matching records.</div>}</div>}
    </div>
  );
}

function DemoDate() {
  const { s, act, toast } = useApp(); const p = usePop(); const t = today(s);
  const [draft, setDraft] = useState(s.offset); const timer = useRef(0);
  useEffect(() => setDraft(s.offset), [s.offset]);
  const set = async (n: number, quiet = false) => { setDraft(n); const r = await act('demo.setOffset', { offset: n }); if (r && !quiet) toast(n ? `System date moved to ${fmtDate(addDays(s.baseDate, n))}. The scheduler ran: reminders and escalations sent.` : 'System date back to today.', 'info'); };
  const slide = (n: number) => { setDraft(n); clearTimeout(timer.current); timer.current = window.setTimeout(() => void set(n, true), 450); };
  return (
    <div style={{ position: 'relative' }} ref={p.ref}>
      <button className="datechip" onClick={() => p.setOpen(!p.open)} aria-expanded={p.open} title="Demo time machine"><Clock3 aria-hidden /><span>Date</span> <b>{fmtDate(t)}</b><ChevronDown aria-hidden /></button>
      {p.open && <div className="pop" style={{ right: 0, top: 'calc(100% + 6px)', width: 320, padding: 14 }}>
        <b style={{ color: 'var(--ink)' }}>Demo time machine</b>
        <p className="muted" style={{ fontSize: '.857rem', margin: '4px 0 10px' }}>Move the system date forward to watch reminders, overdue flags and escalations fire.</p>
        <input type="range" min={0} max={1095} value={draft} onChange={e => slide(+e.target.value)} style={{ width: '100%', accentColor: 'var(--blue)' }} aria-label="Days ahead" />
        <div className="row" style={{ marginTop: 8 }}>{[30, 90, 365].map(n => <button key={n} className="btn sm" onClick={() => void set(s.offset + n)}>+{n === 365 ? '1 year' : n + ' days'}</button>)}<button className="btn sm ghost" onClick={() => void set(0)}>Reset</button></div>
      </div>}
    </div>
  );
}

function Notifications() {
  const { s, user, nav } = useApp(); const p = usePop(); const t = today(s);
  const items = useMemo(() => {
    if (!user) return [];
    const ns = s.notices.filter(n => n.to === 'all' || (n.to === user.role && (!n.instId || n.instId === user.instId) && (!n.bankCode || n.bankCode === user.bankCode))).slice(0, 6)
      .map(n => ({ k: n.id, tone: n.tone, t: n.title, m: `${n.body} · ${fmtDate(n.at)}`, go: () => n.ref && nav('deposit', n.ref) }));
    let fl: { k: string; tone: string; t: string; m: string; go: () => void }[] = [];
    if (user.role === 'officer') fl = allFlags(s).filter(f => f.sev === 'critical').slice(0, 6).map((f, i) => ({ k: 'f' + i, tone: 'bad', t: f.title, m: s.institutions.find(x => x.id === f.instId)!.name, go: () => f.depId ? nav('deposit', f.depId) : nav('institution', f.instId) }));
    if (user.role === 'institution') fl = s.deposits.filter(d => d.instId === user.instId).flatMap(d => flagsOf(d, s, t)).slice(0, 6).map((f, i) => ({ k: 'f' + i, tone: f.sev === 'critical' ? 'bad' : 'warn', t: f.title, m: f.detail, go: () => nav('deposit', f.depId) }));
    if (user.role === 'bank') fl = s.deposits.filter(d => d.bankCode === user.bankCode && (d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker')).slice(0, 6).map(d => ({ k: d.id, tone: 'info', t: `Confirm ${d.number}`, m: `Waiting ${diffDays(t, d.requestedOn || t)} days`, go: () => nav('desk', d.id) }));
    return [...ns, ...fl];
  }, [s, user, nav, t]);
  return (
    <div style={{ position: 'relative' }} ref={p.ref}>
      <button className="iconbtn" onClick={() => p.setOpen(!p.open)} aria-label={`Notifications, ${items.length}`} aria-expanded={p.open}><Bell />{items.length > 0 && <span className="n">{items.length}</span>}</button>
      {p.open && <div className="pop" style={{ right: 0, top: 'calc(100% + 6px)', width: 'min(380px, 90vw)', maxHeight: 440, overflow: 'auto' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', fontWeight: 600, color: 'var(--ink)' }}>Notifications</div>
        <div className="list">{items.length ? items.map(i => <button key={i.k} className="li" onClick={() => { i.go(); p.setOpen(false); }}><span className={`mark ${i.tone}`} /><div><div className="ttl" style={{ fontSize: '.929rem' }}>{i.t}</div><div className="meta">{i.m}</div></div><span /></button>) : <div className="empty">Nothing needs your attention.</div>}</div>
      </div>}
    </div>
  );
}

function UserMenu() {
  const { s, user, demoSwitch, logout, reset, nav, api } = useApp(); const p = usePop();
  if (!user) return null;
  const initials = user.name.replace(/^Registrar, /, '').split(/[ .]+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const demos = s.users.filter(u => ['U1', 'U2', 'U3', 'U4'].includes(u.id));
  const label: Record<Role, string> = { officer: 'AICTE officer', institution: 'Institution', bank: 'Bank' };
  return (
    <div style={{ position: 'relative' }} ref={p.ref}>
      <button className="userbtn" onClick={() => p.setOpen(!p.open)} aria-expanded={p.open}><span className="av">{initials}</span><div><div className="nm">{user.name}</div><div className="rl">{user.designation}</div></div><ChevronDown width={16} aria-hidden /></button>
      {p.open && <div className="pop menu" style={{ right: 0, top: 'calc(100% + 6px)' }}>
        <div className="sec">Switch demo user</div>
        {demos.map(u => <button key={u.id} onClick={() => { p.setOpen(false); void demoSwitch(u); }} aria-current={u.id === user.id}><span>{u.name}</span><small>{label[u.role]} · {u.designation}</small></button>)}
        <hr />
        {user.role === 'officer' && <button onClick={() => { nav('settings'); p.setOpen(false); }}><span><UserCog width={15} style={{ verticalAlign: -2, marginRight: 6 }} />Settings</span></button>}
        <button onClick={() => { void reset(); }}><span>Reset demo data</span><small>{api ? 'Re-seeds the server database' : 'Restores the original records'}</small></button>
        <button onClick={() => { void logout(); }}><span><LogOut width={15} style={{ verticalAlign: -2, marginRight: 6 }} />Sign out</span></button>
      </div>}
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { user, route, nav } = useApp(); const groups = useNav();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  const portal = user?.role === 'officer' ? ['AICTE officer portal', user.region === 'HQ' ? 'Regulation Bureau, HQ' : `${user.region} Regional Office`] : user?.role === 'institution' ? ['Institution portal', user.name.replace('Registrar, ', '')] : ['Bank portal', `${user?.bankCode} · ${user?.bankRole === 'checker' ? 'Branch manager (checker)' : 'Branch officer (maker)'}`];
  const isCur = (id: string) => route.page === id || (id === 'register' && route.page === 'deposit' && user?.role === 'officer') || (id === 'institutions' && route.page === 'institution') || (id === 'deposits' && route.page === 'deposit' && user?.role === 'institution');
  const btn = (i: Item) => <button key={i.id} className="navbtn" aria-current={isCur(i.id) ? 'page' : undefined} onClick={() => nav(i.id)}><i.icon aria-hidden />{i.label}{!!i.count && <span className={`cnt ${i.bad ? 'bad' : ''}`}>{i.count}</span>}</button>;
  return (
    <div className={`shell ${open ? 'open' : ''}`}>
      <a className="skip" href="#main">Skip to main content</a>
      <aside className="side" aria-label="Portal navigation">
        <Brand light onClick={() => nav('home')} />
        <div className="portal"><small>{portal[0]}</small><b>{portal[1]}</b></div>
        {groups.map(g => <div className="navgrp" key={g.group}><div>{g.group}</div>{g.items.map(btn)}</div>)}
        <div className="helpcard" style={{ marginTop: 18 }}><b>Need help?</b>Helpdesk sdfp-help@example.in<br />Mon–Fri, 9:30 to 6:00</div>
      </aside>
      <div className="drawer-scrim" onClick={() => setOpen(false)} />
      <div className="colmain">
        <GovStrip wide />
        <header className="topbar"><div className="tb">
          <button className="iconbtn menubtn" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          {user?.role !== 'institution' ? <GlobalSearch /> : <span className="slim">Institution portal · AICTE SDFP</span>}
          <div className="grow" />
          <div className="topctl"><DemoDate /><Notifications /><UserMenu /></div>
        </div></header>
        <main className="main" id="main"><div className="pagefx" key={route.page + (route.id || '')}>{children}</div></main>
        <GovFooter compact />
      </div>
      <QuickScan />
      <Toasts />
      <button className="fab" onClick={() => window.dispatchEvent(new Event('sdfp-scan'))} aria-label="Quick Scan: scan an FDR sticker"><ScanLine aria-hidden />Scan</button>
    </div>
  );
}
