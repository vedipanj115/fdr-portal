import { useEffect, useMemo, useState } from 'react';
import { CAN_SIMULATE_TAMPERING, getAuditLog, setAuditTampering, verifyAuditLog } from '../../api/client';

// Every action is chained to the previous one by SHA-256 (see utils/hashChain.js).
// Verify recomputes the chain; editing any past entry breaks it from that entry onwards.
const NO_FDR = '__none';
const short = (hash) => (hash ? hash.slice(0, 8) : '—');

export default function AuditLog() {
  const [rows, setRows] = useState(null);
  const [result, setResult] = useState(null); // { valid, entries, brokenAt }
  const [verifying, setVerifying] = useState(false);
  const [tampered, setTampered] = useState(null); // { id, from, to } while the demo is on
  const [fdrFilter, setFdrFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  useEffect(() => { getAuditLog().then(setRows); }, []);

  const verify = async () => {
    setVerifying(true);
    setResult(await verifyAuditLog());
    setVerifying(false);
  };

  const toggleTampering = async (on) => {
    const t = await setAuditTampering(on);
    setTampered(on ? t : null);
    setResult(null); // the old verdict no longer applies
    setRows(await getAuditLog());
  };

  const fdrIds = useMemo(() => [...new Set((rows || []).map((r) => r.fdrId).filter(Boolean))].sort(), [rows]);
  const actions = useMemo(() => [...new Set((rows || []).map((r) => r.action))].sort(), [rows]);
  const shown = (rows || []).filter((r) =>
    (!fdrFilter || (fdrFilter === NO_FDR ? !r.fdrId : r.fdrId === fdrFilter)) && (!actionFilter || r.action === actionFilter));

  const brokenAt = result && !result.valid ? result.brokenAt : null;
  const isBroken = (r) => brokenAt != null && r.id >= brokenAt;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Audit log</h1>
          <p className="text-sm text-gray-500">Each entry stores a SHA-256 hash of its contents and the previous entry's hash. Editing any past entry breaks every link after it.</p>
        </div>
        <button onClick={verify} disabled={verifying || !rows} className="rounded-md bg-navy-700 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60">
          {verifying ? 'Verifying…' : 'Verify chain'}
        </button>
      </div>

      {CAN_SIMULATE_TAMPERING && (
        <div className="rounded-lg border border-dashed border-violet-300 bg-violet-50 px-4 py-3">
          <label className="flex cursor-pointer items-center gap-3">
            <input type="checkbox" role="switch" checked={!!tampered} onChange={(e) => toggleTampering(e.target.checked)} className="h-4 w-4 accent-violet-600" />
            <span className="text-sm font-medium text-violet-900">
              <span className="mr-2 rounded bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Demo</span>
              Simulate tampering
            </span>
          </label>
          <p className="mt-1 text-xs text-violet-800">
            {tampered
              ? <>Entry #{tampered.id} ({tampered.fdrId}) was changed from <code>{tampered.from}</code> to <code>{tampered.to}</code> directly in storage; its stored hash was not updated. Click Verify chain.</>
              : 'Edits one past entry directly in storage, as someone with database access might. Turn off to restore it.'}
          </p>
        </div>
      )}

      {result && (result.valid ? (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          <p className="font-semibold">✓ Chain intact — {result.entries} entries verified</p>
        </div>
      ) : (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
          <p className="font-semibold">✗ Chain broken at entry #{result.brokenAt}</p>
          <p className="mt-0.5">Entry #{result.brokenAt} was edited after it was recorded, so its hash no longer matches and every later link breaks.</p>
        </div>
      ))}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="filter-fdr" className="block text-xs font-medium text-gray-600">FDR</label>
          <select id="filter-fdr" value={fdrFilter} onChange={(e) => setFdrFilter(e.target.value)} className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All FDRs</option>
            <option value={NO_FDR}>System (no FDR)</option>
            {fdrIds.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="filter-action" className="block text-xs font-medium text-gray-600">Action</label>
          <select id="filter-action" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="mt-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm">
            <option value="">All actions</option>
            {actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {(fdrFilter || actionFilter) && (
          <button onClick={() => { setFdrFilter(''); setActionFilter(''); }} className="pb-1.5 text-sm text-navy-600 hover:underline">Clear filters</button>
        )}
        {rows && <p className="ml-auto pb-1.5 text-xs text-gray-500">Showing {shown.length} of {rows.length} entries</p>}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">When</th>
              <th className="px-4 py-2">Who</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">FDR</th>
              <th className="px-4 py-2">Hash ← previous</th>
              {result && <th className="px-4 py-2">Check</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!rows && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>}
            {rows && shown.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-500">No entries match these filters.</td></tr>}
            {shown.map((r) => (
              <tr key={r.id} className={isBroken(r) ? `bg-red-50 ${r.id === brokenAt ? 'outline outline-2 -outline-offset-2 outline-red-500' : ''}` : ''}>
                <td className="px-4 py-2.5 tabular-nums text-gray-500">{r.id}</td>
                <td className="whitespace-nowrap px-4 py-2.5">{new Date(r.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-4 py-2.5">{r.actor}</td>
                <td className={`px-4 py-2.5 font-mono text-xs ${r.id === brokenAt ? 'font-bold text-red-700' : ''}`}>{r.action}</td>
                <td className="px-4 py-2.5">{r.fdrId || '—'}</td>
                <td className={`whitespace-nowrap px-4 py-2.5 font-mono text-xs ${isBroken(r) ? 'text-red-700' : 'text-gray-500'}`} title={`${r.hash}\n← ${r.prevHash}`}>
                  {short(r.hash)} ← {short(r.prevHash)}
                </td>
                {result && (
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs font-medium">
                    {!isBroken(r) ? <span className="text-emerald-700">✓ Verified</span>
                      : r.id === brokenAt ? <span className="text-red-700">✗ Hash mismatch</span>
                        : <span className="text-red-600">✗ Link broken</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
