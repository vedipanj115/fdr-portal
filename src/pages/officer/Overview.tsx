import { useMemo, useState } from 'react';
import { ArrowRight, FileBarChart, Database, BadgeCheck, Hourglass, CalendarClock, Siren, FileCheck2, Archive, Upload, Landmark, ShieldCheck } from 'lucide-react';
import { Pipeline } from '../../components/fx';
import IndiaMap, { scoreColor, type RegionStat } from '../../components/IndiaMap';
import { useApp } from '../../lib/store';
import { LIFE, LIFE_COLOR, LIFE_HELP, alertsFor, allFlags, effMaturity, isOpen, life, today, type Life } from '../../lib/rules';
import { REGIONS } from '../../lib/data';
import { addDays, diffDays, fmtDate, fmtDateTime, fmtMonth, inr, inrCr, num, pct } from '../../lib/util';
import { Kpi, PageHead, Panel, QuickActions, SevBadge } from '../../components/ui';
import { Columns, Donut, HBars, Stack100 } from '../../components/charts';
import type { Region } from '../../lib/types';

export default function Overview() {
  const { s, nav, user } = useApp();
  const [region, setRegion] = useState<Region | 'all'>(user?.region && user.region !== 'HQ' ? user.region : 'all');
  const t = today(s);
  const m = useMemo(() => {
    const instIds = new Set(s.institutions.filter(i => region === 'all' || i.region === region).map(i => i.id));
    const deps = s.deposits.filter(d => instIds.has(d.instId));
    const open = deps.filter(isOpen);
    const byLife = Object.fromEntries(LIFE.map(l => [l, { n: 0, v: 0 }])) as Record<Life, { n: number; v: number }>;
    deps.forEach(d => { const l = life(d, s, t); byLife[l].n++; byLife[l].v += d.claimed.amountLakh; });
    const verified = open.filter(d => d.verification === 'Verified');
    const pending = open.filter(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker');
    const oldest = pending.reduce((a, d) => Math.max(a, diffDays(t, d.requestedOn || t)), 0);
    const flags = allFlags(s).filter(f => instIds.has(f.instId));
    const crit = flags.filter(f => f.sev === 'critical');
    // maturity schedule (next 12 months)
    const months: { m: string; key: string; n: number; v: number; season: boolean }[] = [];
    for (let k = 0; k < 12; k++) { const d0 = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 + k, 1)); const key = d0.toISOString().slice(0, 7); months.push({ key, m: fmtMonth(key + '-01'), n: 0, v: 0, season: d0.getUTCMonth() < 4 }); }
    verified.filter(d => !d.release).forEach(d => { const mm = months.find(x => x.key === effMaturity(d).slice(0, 7)); if (mm) { mm.n++; mm.v += d.claimed.amountLakh; } });
    // bank turnaround
    const bt: Record<string, { name: string; days: number[]; pend: number }> = {};
    deps.filter(d => d.kind === 'FDR').forEach(d => {
      const b = (bt[d.bankCode] ||= { name: d.bankName.replace(' (fictional)', ''), days: [], pend: 0 });
      if (d.confirmed && d.requestedOn) b.days.push(Math.max(1, diffDays(d.confirmed.on, d.requestedOn)));
      if (d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker') b.pend++;
    });
    const banks = Object.values(bt).filter(b => b.days.length).map(b => ({ name: b.name, avg: +(b.days.reduce((a, x) => a + x, 0) / b.days.length).toFixed(1), n: b.days.length, pend: b.pend })).sort((a, b) => b.avg - a.avg);
    const allTat = deps.filter(d => d.confirmed && d.requestedOn && d.kind === 'FDR').map(d => diffDays(d.confirmed!.on, d.requestedOn!));
    const avgTat = allTat.length ? allTat.reduce((a, x) => a + x, 0) / allTat.length : 0;
    const regions = REGIONS.filter(r => region === 'all' || r.name === region).map(r => {
      const ids = new Set(s.institutions.filter(i => i.region === r.name).map(i => i.id));
      const od = open.filter(d => ids.has(d.instId));
      const ls = Object.fromEntries(LIFE.map(l => [l, 0])) as Record<Life, number>; od.forEach(d => ls[life(d, s, t)]++);
      return { r, inst: ids.size, open: od.length, value: od.reduce((a, d) => a + d.claimed.amountLakh, 0), ver: pct(od.filter(d => d.verification === 'Verified').length, od.length), ls, crit: crit.filter(f => ids.has(f.instId)).length };
    });
    const alerts = alertsFor(s).filter(a => instIds.has(a.instId) && diffDays(t, a.at) <= 30);
    const disc = flags.filter(f => ['amount', 'maturity', 'lien', 'notfound', 'bank', 'dup', 'tamper'].includes(f.code)).length;
    const complete = open.filter(d => d.verification === 'Verified' && d.affidavit && d.docs.length >= 2).length;
    return { deps, open, byLife, verified, pending, oldest, flags, crit, months, banks, avgTat, regions, alerts, disc, complete };
  }, [s, t, region]);
  const exp = m.byLife.Expiring;
  const mapStats: RegionStat[] = useMemo(() => { const fl = allFlags(s); return REGIONS.map(r => { const ids = new Set(s.institutions.filter(i => i.region === r.name).map(i => i.id)); const od = s.deposits.filter(d => ids.has(d.instId) && isOpen(d)); const critDeps = new Set(fl.filter(f => f.sev === 'critical' && ids.has(f.instId)).map(f => f.depId)); const good = od.filter(d => d.verification === 'Verified' && !critDeps.has(d.id)).length; return { region: r.name, office: r.office, score: pct(good, od.length), open: od.length, crit: fl.filter(f => f.sev === 'critical' && ids.has(f.instId)).length, pending: od.filter(d => d.verification === 'Awaiting bank' || d.verification === 'Awaiting checker').length, value: inrCr(od.reduce((a, d) => a + d.claimed.amountLakh, 0)) }; }); }, [s]);
  const sp = useMemo(() => { const keys: string[] = []; for (let k = 11; k >= 0; k--) keys.push(new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1 - k, 1)).toISOString().slice(0, 7));
    const subm = keys.map(k => s.deposits.filter(d => d.submittedOn.slice(0, 7) === k).length); const conf = keys.map(k => s.deposits.filter(d => d.confirmed?.on.slice(0, 7) === k).length);
    let c0 = s.deposits.filter(d => d.submittedOn.slice(0, 7) < keys[0] && isOpen(d)).length; const cum = subm.map(v => (c0 += v));
    const al = alertsFor(s); const esc = keys.map(k => al.filter(a => a.sev === 'critical' && a.at.slice(0, 7) === k).length);
    return { subm, conf, cum, esc }; }, [s, t]);
  const recent = s.audit.slice(-7).reverse();

  return (
    <>
      <PageHead title={`Namaste, ${user?.name}`} sub={<>Overview of {region === 'all' ? 'all Regional Offices' : `the ${region} Regional Office`} · as on {fmtDate(t)}</>}
        actions={<><select className="input" style={{ width: 'auto' }} value={region} onChange={e => setRegion(e.target.value as Region | 'all')} aria-label="Region"><option value="all">All regions</option>{REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}</select><button className="btn" onClick={() => nav('reports')}><FileBarChart aria-hidden />Reports</button></>} />

      <div className="kgrid">
        <Kpi icon={Database} color="#2f6bff" label="Deposits on record" value={num(m.open.length)} sub={<>{inrCr(m.open.reduce((a, d) => a + d.claimed.amountLakh, 0))} submitted</>} spark={sp.cum} onClick={() => nav('register')} />
        <Kpi icon={BadgeCheck} color="#12a150" tone="good" label="Bank-verified" value={pct(m.verified.length, m.open.length)} unit="%" sub={<>{inrCr(m.verified.reduce((a, d) => a + (d.confirmed?.amountLakh || 0), 0))} confirmed</>} spark={sp.conf} onClick={() => nav('register')} />
        <Kpi icon={Hourglass} color="#7c4dff" label="Pending verification" value={m.pending.length} sub={<>Oldest <b>{m.oldest} days</b> · SLA {s.config.bankSla}</>} spark={sp.subm} onClick={() => nav('verify')} />
        <Kpi icon={CalendarClock} color="#ff8a1f" tone="warn" label={`Maturing in ${Math.max(...s.config.reminders)} days`} value={exp.n} sub={<>{inr(exp.v)} due</>} spark={m.months.map(x => x.n)} onClick={() => nav('maturity')} />
        <Kpi icon={Siren} color="#ef4444" tone="bad" label="Need intervention" value={m.crit.length} sub={<>across {new Set(m.crit.map(f => f.instId)).size} institutions</>} spark={sp.esc} onClick={() => nav('alerts')} />
      </div>

      <QuickActions items={[
        { icon: BadgeCheck, label: 'Verification queue', sub: `${m.pending.length} waiting for banks`, color: 'linear-gradient(135deg,#2f6bff,#1739a8)', onClick: () => nav('verify') },
        { icon: FileCheck2, label: 'Release requests', sub: `${s.deposits.filter(d => d.release?.status === 'Requested').length} awaiting decision`, color: 'linear-gradient(135deg,#e05ca0,#b83280)', onClick: () => nav('releases') },
        { icon: CalendarClock, label: 'Maturity tracker', sub: `${exp.n} maturing soon`, color: 'linear-gradient(135deg,#ff9a3c,#e8700a)', onClick: () => nav('maturity') },
        { icon: FileBarChart, label: 'Generate report', sub: '5 ready-made reports', color: 'linear-gradient(135deg,#16b35c,#0f8a45)', onClick: () => nav('reports') },
        { icon: Archive, label: 'FDR vault', sub: 'Originals and QR stickers', color: 'linear-gradient(135deg,#475569,#1e293b)', onClick: () => nav('vault') },
      ]} />
      <Panel title="Live deposit pipeline" sub="Where every instrument is right now. Dots show work moving between stages; select a stage to open it." className="pipepanel">
        <Pipeline stages={[
          { label: 'Submitted this month', sub: 'New FDRs and online deposits', count: s.deposits.filter(d => d.submittedOn.slice(0, 7) === t.slice(0, 7)).length, icon: Upload, color: '#2f6bff', onClick: () => nav('register') },
          { label: 'With banks', sub: `Awaiting confirmation · SLA ${s.config.bankSla} days`, count: m.pending.length, icon: Landmark, color: '#7c4dff', onClick: () => nav('verify') },
          { label: 'Active and tracked', sub: 'Bank-verified, reminders scheduled', count: m.byLife.Active.n + m.byLife.Expiring.n, icon: ShieldCheck, color: '#12a150', onClick: () => nav('register', 'life:Active') },
          { label: 'Due or matured', sub: 'Renewal or release needed', count: m.byLife.Expiring.n + m.byLife.Matured.n, icon: CalendarClock, color: '#ff8a1f', onClick: () => nav('maturity') },
          { label: 'Released or renewed', sub: 'NOC issued or replaced', count: m.byLife.Released.n + m.byLife.Renewed.n, icon: FileCheck2, color: '#e05ca0', onClick: () => nav('releases') },
        ]} />
      </Panel>
      <div style={{ height: 20 }} />
      <div className="layout">
        <Panel className="s7" title="India compliance map" sub="Regional Offices coloured by compliance score: share of open deposits that are bank-verified with no critical issue. Select a region to focus the dashboard."
          actions={region !== 'all' ? <button className="btn sm" onClick={() => setRegion('all')}>Show all India</button> : undefined}>
          <div className="mapwrap">
            <div><IndiaMap stats={mapStats} sel={region} onPick={setRegion} /><div className="mlegend"><span><i style={{ background: '#12a150' }} />92%+</span><span><i style={{ background: '#6cc58f' }} />85–91%</span><span><i style={{ background: '#ffb066' }} />75–84%</span><span><i style={{ background: '#ff7a1a' }} />Below 75%</span><span><i style={{ background: '#ef4444', borderRadius: 6 }} />Pulsing pin: critical cases</span></div></div>
            <div className="rrank">{mapStats.slice().sort((a, b) => a.score - b.score).map(r => <button key={r.region} aria-pressed={region === r.region} onClick={() => setRegion(region === r.region ? 'all' : r.region)}><span className="rt"><span>{r.region}</span><span style={{ color: scoreColor(r.score) }}>{r.score}%</span></span><span className="meter"><i style={{ width: r.score + '%', background: scoreColor(r.score) }} /></span></button>)}</div>
          </div>
        </Panel>
        <Panel className="s5" title="Cases needing intervention" sub="Critical issues, most serious first" flush actions={<button className="btn sm ghost" onClick={() => nav('alerts')}>View all<ArrowRight aria-hidden /></button>}>
          <div className="list">{m.crit.slice(0, 8).map((f, i) => <button key={i} className="li" onClick={() => f.depId ? nav('deposit', f.depId) : nav('institution', f.instId)}><span className="mark bad" /><div><div className="ttl">{f.title}</div><div className="meta">{s.institutions.find(x => x.id === f.instId)!.name} · {f.detail}</div></div><SevBadge s={f.sev} /></button>)}
            {!m.crit.length && <div className="empty">No critical cases.</div>}</div>
        </Panel>
        <Panel className="s5" title="Deposits by status" sub="Every instrument on record, by where it is in its lifecycle. Select a status to open the register.">
          <div className="col">
            <Donut height={220} data={LIFE.map(l => ({ name: l, value: m.byLife[l].n, color: LIFE_COLOR[l] }))} center={num(m.deps.length)} sub="instruments" onPick={n => nav('register', 'life:' + n)} />
            <div className="legend">{LIFE.map(l => <button key={l} onClick={() => nav('register', 'life:' + l)}><i style={{ background: LIFE_COLOR[l] }} /><span><span style={{ color: 'var(--ink)', fontWeight: 500 }}>{l}</span><small>{LIFE_HELP[l]}</small></span><span className="n">{m.byLife[l].n}</span><span className="v">{inr(m.byLife[l].v)}</span></button>)}</div>
          </div>
        </Panel>

        <Panel className="s7" title="Maturity schedule, next 12 months" sub="Bank-verified deposits by month of maturity. Jan–Apr is AICTE's approval season, when refunds tend to be held up, so those deposits are flagged early."
          foot={<span className="row" style={{ gap: 16 }}><span className="dot" style={{ ['--dc' as string]: 'var(--c1)' }}>Other months</span><span className="dot" style={{ ['--dc' as string]: 'var(--c4)' }}>Approval season (Jan–Apr)</span></span>}>
          <Columns data={m.months} x="m" y="n" color="var(--c1)" highlight={d => !!d.season} hiColor="var(--c4)" tip={p => <><div className="r"><span>Deposits</span><b style={{ margin: 0 }}>{String(p.n)}</b></div><div className="r"><span>Value</span><span>{inr(p.v as number)}</span></div>{p.season ? <div className="muted" style={{ marginTop: 4 }}>Approval season</div> : null}</>} />
        </Panel>
        <Panel className="s4" title="Bank verification turnaround" sub={`Average days from request to confirmation. SLA is ${s.config.bankSla} days.`}
          foot={<span className="row" style={{ gap: 16 }}><span className="dot" style={{ ['--dc' as string]: 'var(--c1)' }}>Within SLA</span><span className="dot" style={{ ['--dc' as string]: 'var(--bad)' }}>Slower than SLA</span><span>Overall average <b>{m.avgTat.toFixed(1)} days</b></span></span>}>
          <HBars data={m.banks} x="avg" y="name" color={d => ((d.avg as number) > s.config.bankSla ? 'var(--bad)' : 'var(--c1)')} refX={s.config.bankSla} refLabel="SLA" tip={p => <><div className="r"><span>Average</span><b style={{ margin: 0 }}>{String(p.avg)} days</b></div><div className="r"><span>Confirmed</span><span>{String(p.n)}</span></div><div className="r"><span>Pending now</span><span>{String(p.pend)}</span></div></>} />
        </Panel>

        <Panel className="s8" title="Regional Offices" sub="Open deposits by status in each region" flush>
          <div className="tw"><table className="t"><thead><tr><th>Regional Office</th><th className="r">Institutions</th><th className="r">Open deposits</th><th className="r">Value</th><th className="r">Verified</th><th style={{ minWidth: 170 }}>Status mix</th><th className="r">Critical</th></tr></thead>
            <tbody>{m.regions.map(r => <tr key={r.r.name} className="click" onClick={() => nav('register', 'region:' + r.r.name)}><td><div className="nm">{r.r.name}</div><div className="s2">{r.r.office}</div></td><td className="r">{r.inst}</td><td className="r">{r.open}</td><td className="r">{inrCr(r.value)}</td><td className="r">{r.ver}%</td>
              <td><Stack100 parts={(['Active', 'Expiring', 'Pending', 'Matured'] as Life[]).map(l => ({ v: r.ls[l], color: LIFE_COLOR[l], label: l }))} /></td><td className="r">{r.crit ? <b style={{ color: 'var(--bad)' }}>{r.crit}</b> : <span className="faint">0</span>}</td></tr>)}</tbody></table></div>
        </Panel>
        <Panel className="s4" title="Recent activity" flush actions={<button className="btn sm ghost" onClick={() => nav('audit')}>Audit trail<ArrowRight aria-hidden /></button>}>
          <div className="list">{recent.map(a => <button key={a.seq} className="li" onClick={() => a.ref.startsWith('SD-') && nav('deposit', a.ref)}><span className="mark info" /><div><div className="ttl" style={{ fontWeight: 500, fontSize: '.929rem' }}>{a.action}</div><div className="meta">{a.actor} · {fmtDateTime(a.at)}</div></div><span /></button>)}</div>
        </Panel>

        <Panel className="s8" title="What the portal is doing for officers" sub="Computed live from the records in this prototype">
          <div className="grid2" style={{ gap: 22 }}>
            <Metric v={`${m.disc}`} l="Discrepancies caught automatically" c="Amount, maturity, lien, duplicate, ineligible bank and tampered-file checks" />
            <Metric v={`${m.alerts.length}`} l="Reminders and escalations sent in 30 days" c="Without anyone drafting a letter" />
            <Metric v={`${m.avgTat.toFixed(1)} d`} l="Average bank confirmation time" c={`Against an SLA of ${s.config.bankSla} days; slow banks are chased automatically`} />
            <Metric v={`${pct(m.complete, m.open.length)}%`} l="Records complete and verified" c="Bank-confirmed with all prescribed documents" />
          </div>
        </Panel>
      </div>
      <p className="faint" style={{ fontSize: '.857rem', marginTop: 14 }}>Window for "maturing" follows the reminder settings ({s.config.reminders.join(' / ')} days). Next scheduled scan {fmtDate(addDays(t, 1))}, 02:00.</p>
    </>
  );
}
function Metric({ v, l, c }: { v: string; l: string; c: string }) {
  return <div style={{ borderLeft: '3px solid var(--blue-line)', paddingLeft: 12 }}><div className="big">{v}</div><div style={{ fontWeight: 600, color: 'var(--ink)' }}>{l}</div><div className="muted" style={{ fontSize: '.857rem' }}>{c}</div></div>;
}
