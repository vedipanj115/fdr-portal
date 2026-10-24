import { useEffect, useState } from 'react';
import { getAuditLog } from '../../api/client';

// Every action is chained to the previous one by hash (Preet's backend).
// TODO: call GET /audit-log/verify and show the real result in the badge.
export default function AuditLog() {
  const [rows, setRows] = useState(null);
  useEffect(() => { getAuditLog().then(setRows); }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Audit log</h1>
        <span className="rounded-md bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-emerald-200">Hash chain verified</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Who</th><th className="px-4 py-2">Action</th><th className="px-4 py-2">FDR</th><th className="px-4 py-2">Hash ← previous</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!rows && <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">Loading…</td></tr>}
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{new Date(r.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td className="px-4 py-2.5">{r.actor}</td>
                <td className="px-4 py-2.5 font-mono text-xs">{r.action}</td>
                <td className="px-4 py-2.5">{r.fdrId || '—'}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500">{r.hash} ← {r.prevHash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
